# API local para clasificar el tipo de riesgo con IA

## Propósito y alcance

Esta guía describe cómo se conectó el modelo BETO ya entrenado en Google
Colab con el reporte de incidentes. El proyecto no vuelve a entrenar el modelo:
lo carga desde artefactos locales y ofrece inferencia mediante FastAPI.

La predicción sugiere el **tipo de peligro GTC 45**. No decide la gravedad ni
calcula la prioridad; esas reglas siguen en el backend de Next.js.

## Arquitectura

```text
Formulario de empleado o modal admin
        │
        │ POST /api/v1/sugerir-tipo-riesgo (JWT Supabase)
        ▼
Ruta Next.js autenticada
        │
        │ POST /predict (red local)
        ▼
FastAPI + BETO cargado desde ml_api/models/
        │
        ▼
Etiqueta del modelo → categoría GTC 45 de la aplicación
```

La ruta de Next.js no entrega las credenciales de Supabase al modelo. El texto
se envía desde el servidor Next.js al servicio local configurado en
`RISK_MODEL_API_URL`, que por defecto es
`http://127.0.0.1:8000/predict`.

## Pasos de implementación

### 1. Preparar los artefactos del modelo

El notebook de Colab ya contenía el modelo entrenado. Se exportaron el modelo y
el tokenizer en formato de Transformers y se colocaron en:

- `ml_api/models/beto_gtc45_model/`
- `ml_api/models/beto_gtc45_tokenizer/`

El servicio carga ambos directorios con `local_files_only=True` y utiliza los
pesos `safetensors`; no necesita descargar el modelo al iniciar. Los directorios
de modelos están excluidos de Git por `.gitignore`, así que cada entorno debe
recibir los artefactos por el canal privado acordado. No se debe cargar el
archivo `.pkl` del notebook.

### 2. Crear el servicio de inferencia FastAPI

`ml_api/main.py` implementa:

- carga del modelo y tokenizer durante el inicio de FastAPI;
- selección de CPU o CUDA si está disponible;
- `GET /health`, que confirma que el modelo terminó de cargar;
- `POST /predict`, que recibe `{"text":"..."}` y devuelve `{"label":"..."}`;
- validación de texto de 1 a 5000 caracteres y truncamiento de entrada a 128
  tokens;
- inferencia con `torch.inference_mode()` y serialización de acceso al modelo.

Las dependencias están en `ml_api/requirements.txt`. El orden de clases está
centralizado en `ml_api/labels.py`:

1. Biologico
2. Biomecanico
3. Condiciones de Seguridad
4. Fenomenos Naturales
5. Fisico
6. Psicosocial
7. Quimico

La etiqueta se selecciona mediante el índice con mayor logit. La API no devuelve
una probabilidad o nivel de confianza.

### 3. Proteger y conectar la ruta de Next.js

`app/api/v1/sugerir-tipo-riesgo/route.ts`:

1. valida el JWT de Supabase;
2. valida el texto recibido;
3. reenvía el texto al servicio configurado en `RISK_MODEL_API_URL`;
4. convierte las etiquetas del modelo al catálogo de la aplicación.

Por ejemplo, `Condiciones de Seguridad` se normaliza al valor interno
`Seguridad`; la interfaz lo presenta como **Condiciones de Seguridad**.
`Fenomenos Naturales` se normaliza a `Fenomeno natural`.

El cliente `utils/incidentesApi.ts` obtiene el token de sesión actual y lo envía
como bearer token. La interfaz nunca llama directamente a FastAPI.

### 4. Integrar la predicción en los dos roles

**Empleado**

- Los cambios del título o la descripción reinician la sugerencia anterior.
- Se envían ambos textos, separados por una nueva línea, 250 ms después del
  último cambio. Las solicitudes anteriores se cancelan.
- El tipo sugerido aparece automáticamente en el campo de solo lectura.
- Si la predicción falla, puede enviar el reporte como `Sin clasificar`; la
  interfaz avisa que requiere revisión.

**Administrador**

- Al abrir un incidente se solicita una sugerencia y se propone en el selector
  editable.
- El encargado puede cambiar el tipo y la gravedad.
- `PATCH /api/v1/incidentes/{id}` verifica que sea admin y aplica en el backend
  la matriz de prioridad existente.
- El cambio de clasificación queda registrado por el trigger de auditoría de
  Supabase.

### 5. Permitir reportes pendientes

Cuando no hay una predicción, el backend guarda `tipo_peligro = 'Sin clasificar'`
y deja `prioridad_asignada` y `requiere_atencion_inmediata` en `null`. Admin
calcula esos campos cuando asigna un tipo válido.

Para una base existente, aplica `db/migrations/003_clasificacion_pendiente.sql`
después de las migraciones 001 y 002. Para una base nueva, ejecuta también
`docs/SUPABASE_BASELINE.sql` antes de esas migraciones.

## Configuración y ejecución local

Se requiere Python compatible con las dependencias de `ml_api/requirements.txt`
y Node.js 20 o posterior. Desde la raíz del repositorio, crea el entorno e
instala los paquetes una sola vez:

```powershell
py -m venv .venv-ml
.\.venv-ml\Scripts\Activate.ps1
python -m pip install -r ml_api\requirements.txt
```

Confirma que los artefactos existen en las dos carpetas descritas arriba. Luego,
en una terminal, inicia el servicio y déjalo ejecutándose:

```powershell
python -m uvicorn ml_api.main:app --host 127.0.0.1 --port 8000
```

Comprueba que el modelo esté listo:

```powershell
Invoke-RestMethod -Uri http://127.0.0.1:8000/health
```

La respuesta debe tener `status: "ok"` y mostrar el dispositivo activo. Para
probar la inferencia directamente:

```powershell
$body = @{ text = "piso mojado`npiso mojado en el baño" } | ConvertTo-Json
Invoke-RestMethod `
  -Uri http://127.0.0.1:8000/predict `
  -Method Post `
  -ContentType "application/json" `
  -Body $body
```

La salida contiene una etiqueta del modelo, por ejemplo
`{"label":"Condiciones de Seguridad"}`. La predicción depende del texto y no es
una garantía de clasificación correcta.

En otra terminal, inicia Next.js:

```powershell
npm run dev
```

Inicia sesión con una cuenta Supabase y prueba el formulario. La ruta Next.js
usa el destino predeterminado local; si se configura `RISK_MODEL_API_URL` con
otro destino, debe ser una variable **privada del servidor**, y hay que
reiniciar Next.js tras cambiarla.

Para probar la correspondencia de etiquetas:

```powershell
.\.venv-ml\Scripts\python.exe -m unittest ml_api.test_labels
```

Las pruebas de integración de la aplicación se ejecutan con:

```powershell
npm test
npm run build
```

## Diagnóstico

Si el campo sigue como `Sin clasificar` o aparece “No se pudo obtener la
clasificación automática”:

1. Comprueba `http://127.0.0.1:8000/health`.
2. Si no responde, verifica que Uvicorn siga abierto en la terminal y vuelve a
   iniciarlo con el comando anterior.
3. Si Uvicorn falla al arrancar, confirma que existan `config.json`,
   `model.safetensors` y los archivos del tokenizer en las carpetas esperadas.
4. Comprueba que se instalaron las dependencias en `.venv-ml` y que Uvicorn se
   ejecutó desde la raíz del repositorio.
5. Si `/health` funciona pero la pantalla falla, revisa la consola del servidor
   Next.js y verifica que no se haya configurado un `RISK_MODEL_API_URL`
   incorrecto. Un cambio de variables requiere reiniciar Next.js.
6. Tras recuperar el servicio, vuelve a editar título o descripción para
   solicitar una predicción nueva.

`503 IA_NO_DISPONIBLE` significa que Next.js no recibió una respuesta utilizable
de FastAPI. Un error `401` corresponde a una sesión Supabase ausente o vencida.

## Privacidad y limitaciones

- Uvicorn debe escuchar en `127.0.0.1`; no lo expongas a Internet ni lo enlaces
  a una interfaz pública.
- El servicio local y sus artefactos no deben incluirse en un despliegue cloud
  que no cumpla la política de privacidad del proyecto.
- El servicio no persiste el texto de inferencia y la API no devuelve confianza.
- El notebook original usó el conjunto de prueba como `eval_dataset` al
  seleccionar el mejor modelo. Las métricas resultantes no son una evaluación
  final independiente; consulta `docs/API_ENDPOINTS.md` antes de interpretar el
  rendimiento del modelo.
