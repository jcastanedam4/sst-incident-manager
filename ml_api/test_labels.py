import unittest

from ml_api.labels import MODEL_LABELS, model_label_for_index


class ModelLabelMappingTests(unittest.TestCase):
    def test_maps_all_model_classes_to_application_values(self) -> None:
        self.assertEqual(
            [model_label_for_index(index) for index in range(len(MODEL_LABELS))],
            [
                "Biologico",
                "Biomecanico",
                "Condiciones de Seguridad",
                "Fenomenos Naturales",
                "Fisico",
                "Psicosocial",
                "Quimico",
            ],
        )

    def test_rejects_unknown_class_index(self) -> None:
        with self.assertRaises(ValueError):
            model_label_for_index(len(MODEL_LABELS))


if __name__ == "__main__":
    unittest.main()
