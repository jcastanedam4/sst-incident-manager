#!/bin/sh

git filter-branch --env-filter '
if [ "$GIT_COMMITTER_EMAIL" = "team@hotel-boutique.dev" ]; then
  export GIT_COMMITTER_NAME="jcastanedam4"
  export GIT_COMMITTER_EMAIL="jcastanedam4@ucentral.edu.co"
fi
if [ "$GIT_AUTHOR_EMAIL" = "team@hotel-boutique.dev" ]; then
  export GIT_AUTHOR_NAME="jcastanedam4"
  export GIT_AUTHOR_EMAIL="jcastanedam4@ucentral.edu.co"
fi
' -- --branches master pr/capacitor-fixes

# End of script
