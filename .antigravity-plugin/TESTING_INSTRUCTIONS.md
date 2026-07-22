The plugin is just dropped in a folder - so the easiest way is to symlink the working source from your app folder like so:

`ln -s ~/firebase/agent-skills/.antigravity-plugin ~/myappdirectory/.agents/plugins/firebase-antigravity-plugin`

Pre-flight checks:
- ensure you're not using corp - this prevents new project creation (you'll get a 401)
  - `gcloud config set account christhompsonfirebase@gmail.com`
- Login for ADC (if you continue to get 401 ensure you check the boxes on login)
  - `gcloud auth application-default login`

