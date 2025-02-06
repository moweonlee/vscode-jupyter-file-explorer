# Jupyter File Explorer

Jupyter File Explorer is a Visual Studio Code extension that allows you to browse and edit files on a remote Jupyter Server directly from your VS Code environment.

Original source code of this project came from https://github.com/supdizh/vscode-ext-jupyter-file-editor 

## Features

- Connect to a remote Jupyter Server.
- Browse files and directories on the remote server.
- Download file into project workspace in VS Code.
- Upload local jupyter notebook file into remote Jupyter server.


You can set default values for the Jupyter Server connection in your VS Code settings:

- `jupyterFileExplorer.defaultServerUrl`: Default Jupyter Server URL ( e.g: http://IPADDRESS:8888 )
- `jupyterFileExplorer.defaultToken`: Default Jupyter Token ( token or passwor to connect Jupyter server )
- `jupyterFileExplorer.defaultRemotePath`: Default Remote Path ( use '/' to access entire jupyter home directory )

## License

This project is licensed under the MIT License - see the [LICENSE.md](LICENSE.md) file for details.

## Disclaimer
From the original project which is generated with AI which is not working, re-developed all the code to work correctly.

