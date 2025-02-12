import * as vscode from 'vscode';
import axios, { AxiosInstance } from 'axios';
import path = require('path');
const fs = require('fs');

export class FileExplorerProvider implements vscode.TreeDataProvider<FileItem>, vscode.FileSystemProvider {
    private _onDidChangeTreeData: vscode.EventEmitter<FileItem | undefined | null> = new vscode.EventEmitter<FileItem | undefined | null>();
    readonly onDidChangeTreeData: vscode.Event<FileItem | undefined | null> = this._onDidChangeTreeData.event;

    private jupyterServerUrl: string = '';
    private jupyterToken: string = '';
    private remotePath: string = '/';
    private currentPath: string ='';
    private axiosInstance: AxiosInstance | null = null;

    private _emitter = new vscode.EventEmitter<vscode.FileChangeEvent[]>();
    readonly onDidChangeFile: vscode.Event<vscode.FileChangeEvent[]> = this._emitter.event;
    

    constructor() {
        
    }

    async setConnection(url: string, token: string, remotePath: string) {
        this.jupyterServerUrl = url;
        this.jupyterToken = token;
        this.remotePath = remotePath;
        this.setupAxiosInstance();
        this.refresh();
    }

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: FileItem): vscode.TreeItem {
        return element;
    }

    public setupAxiosInstance() {
        this.axiosInstance = axios.create({
            baseURL: this.jupyterServerUrl,
            headers: {
                'Authorization': `token ${this.jupyterToken}`
            }
        });
    }

    async getChildren(element?: FileItem): Promise<FileItem[]> {

        if (!this.axiosInstance) {
            vscode.window.showErrorMessage('Not connected to Jupyter Server.');
            return [];
        }

        const currentPath = element ? element.uri : this.remotePath;
        this.currentPath = currentPath;
        const apiUrl = `api/contents/${currentPath}`;

        try {
            const response = await this.axiosInstance.get(apiUrl);
            return response.data.content.map((item: any) => new FileItem(item.name, item.type === 'directory', item.path));
        } catch (error) {
            let errorMessage = `Failed to fetch file list from Jupyter Server. API URL: ${apiUrl}`;
            if (axios.isAxiosError(error)) {
                errorMessage += ` Error: ${error.message}`;
                if (error.response) {
                    errorMessage += ` Status: ${error.response.status}`;
                    errorMessage += ` Data: ${JSON.stringify(error.response.data)}`;
                }
            } else {
                errorMessage += ` ${error}`;
            }
            console.error(errorMessage);
            vscode.window.showErrorMessage(errorMessage);
            return [];
        }
    }

    async createChildDirectory(filePath: string) {
        if (!this.axiosInstance) {
            vscode.window.showErrorMessage('Not connected to Jupyter Server.');
            return;
        }

        const subdirectoryName = await vscode.window.showInputBox({
            prompt: 'Enter the name of the new subdirectory',
            placeHolder: 'Subdirectory name'
        });

        if (!subdirectoryName) {
            vscode.window.showInformationMessage('Subdirectory creation cancelled.');
            return;
        }
        const checkDirectoryPath = `${filePath}/${subdirectoryName}`;
        const checkApiUrl = `api/contents/${checkDirectoryPath}`;

        try {
            const checkResponse = await this.axiosInstance.get(checkApiUrl);
            if (checkResponse.status === 200) {
            vscode.window.showErrorMessage(`Subdirectory ${subdirectoryName} already exists.`);
            return;
            }
        } catch (error) {
            if (axios.isAxiosError(error) && error.response && error.response.status !== 404) {
            let errorMessage = 'Failed to check subdirectory existence on Jupyter Server.';
            errorMessage += ` Error: ${error.message}`;
            if (error.response) {
                errorMessage += ` Status: ${error.response.status}`;
                errorMessage += ` Data: ${JSON.stringify(error.response.data)}`;
            }
            vscode.window.showErrorMessage(errorMessage);
            return;
            }
        }
        const newDirectoryPath = `${filePath}/${subdirectoryName}`;

        try {
            const apiUrl = `api/contents/${newDirectoryPath}`;
            await this.axiosInstance.put(apiUrl, {
                type: 'directory'
            });
            vscode.window.showInformationMessage(`Subdirectory ${subdirectoryName} created successfully.`);
            this.refresh();
        } catch (error) {
            let errorMessage = 'Failed to create subdirectory on Jupyter Server.';
            if (axios.isAxiosError(error)) {
                errorMessage += ` Error: ${error.message}`;
                if (error.response) {
                    errorMessage += ` Status: ${error.response.status}`;
                    errorMessage += ` Data: ${JSON.stringify(error.response.data)}`;
                }
            } else {
                errorMessage += ` ${error}`;
            }
            vscode.window.showErrorMessage(errorMessage);
        }
    }

    async deleteFile(filePath: string) {
        if (!this.axiosInstance) {
            vscode.window.showErrorMessage('Not connected to Jupyter Server.');
            return;
        }

        const confirm = await vscode.window.showWarningMessage(
            `Are you sure you want to delete the file ${filePath}?`,
            { modal: true },
            'Yes', 'No'
        );

        if (confirm !== 'Yes') {
            vscode.window.showInformationMessage('File delete operation cancelled.');
            return;
        }

        try {
            const apiUrl = `api/contents/${filePath}`;
            await this.axiosInstance.delete(apiUrl);
            vscode.window.showInformationMessage(`File ${filePath} deleted successfully.`);
            this.refresh();
        } catch (error) {
            let errorMessage = 'Failed to delete file from Jupyter Server.';
            if (axios.isAxiosError(error)) {
                errorMessage += ` Error: ${error.message}`;
                if (error.response) {
                    errorMessage += ` Status: ${error.response.status}`;
                    errorMessage += ` Data: ${JSON.stringify(error.response.data)}`;
                }
            } else {
                errorMessage += ` ${error}`;
            }
            vscode.window.showErrorMessage(errorMessage);
        }
    }

    
    async openFile(filePath: string) {
        if (!this.axiosInstance) {
            vscode.window.showErrorMessage('Not connected to Jupyter Server.');
            return;
        }

        try {
            const fileName = filePath.split('/').pop() || 'untitled';
            const content = await this.fetchFileContent(filePath);

            vscode.window.showInformationMessage( content );

            const workspaceFolder = vscode.workspace.workspaceFolders?.[0].uri.fsPath;

            if (!workspaceFolder) {
                vscode.window.showErrorMessage('Workspace folder is undefined. Please set your workspace');
                return;
            }

            const localFilePath = `${workspaceFolder}${path.sep}${fileName}`;

            //const dirPath = path.dirname(localFilePath);
            //if (!fs.existsSync(dirPath)) {
            //   fs.mkdirSync(dirPath, { recursive: true });
            //}

            if (fs.existsSync(localFilePath)) {
                const overwrite = await vscode.window.showWarningMessage(
                    `File ${localFilePath} already exists. Do you want to overwrite it?`,
                    { modal: true },
                    'Yes', 'No'
                );

                if (overwrite !== 'Yes') {
                    vscode.window.showInformationMessage('File open operation cancelled.');
                    return;
                }
            }

            const contentToWrite = typeof content === 'object' ? JSON.stringify(content, null, 2) : content;

            fs.writeFileSync(localFilePath, contentToWrite);

            // Open the document with the custom URI
            const document = await vscode.workspace.openTextDocument(localFilePath);
            vscode.Uri.parse(`vscode-notebook-cell:${localFilePath}`);
            
            vscode.window.showInformationMessage(`Download completed in ${localFilePath}`);

            // Set the file name and language
            await vscode.languages.setTextDocumentLanguage(document, this.getLanguageId(fileName));

        } catch (error) {
            let errorMessage = 'Failed to open file.';
            if (error instanceof Error) {
                errorMessage += ` Error: ${error.message}`;
            }
            vscode.window.showErrorMessage(errorMessage);
        }
    }

    private async fetchFileContent(filePath: string): Promise<string> {
        if (!this.axiosInstance) {
            throw new Error('Not connected to Jupyter Server.');
        }

        const apiUrl = `api/contents/${filePath}`;
        try {
            const response = await this.axiosInstance.get(apiUrl);
            return response.data['content'];
            
        } catch (error) {
            console.error('Failed to fetch file content:', error);
            throw new Error('Failed to fetch file content from Jupyter Server.');
        }
    }

    private getLanguageId(fileName: string): string {
        const extension = fileName.split('.').pop()?.toLowerCase();
        switch (extension) {
            case 'py':
                return 'python';
            case 'js':
                return 'javascript';
            case 'ts':
                return 'typescript';
            // Add more mappings as needed
            default:
                return 'plaintext';
        }
    }

    public async saveFileToJupyter(filePath: string, content: string) {
        if (!this.axiosInstance) {
            vscode.window.showErrorMessage('Not connected to Jupyter Server.');
            return;
        }

        try {
            let normalizedFilePath: string;
            if (this.currentPath) {
                normalizedFilePath = `${this.currentPath}/${path.basename(filePath).replace(/\\/g, '/')}`;
            } else {
                normalizedFilePath = `${this.remotePath}/${path.basename(filePath).replace(/\\/g, '/')}`;
            }
            
            const apiUrl = `${this.jupyterServerUrl}/api/contents/${normalizedFilePath}?token=${this.jupyterToken}`;
            const confirm = await vscode.window.showWarningMessage(
                `Are you sure you want to save the file?\nLocal Path: ${filePath}\nRemote Path: ${normalizedFilePath}`,
                { modal: true },
                'Yes', 'No'
            );

            if (confirm !== 'Yes') {
                vscode.window.showInformationMessage('File save operation cancelled.');
                return;
            }

            vscode.window.showInformationMessage(`File saved to Jupyter Server. Path: ${filePath}, API URL: ${apiUrl}, Content: ${content}`);
            await this.axiosInstance.put(apiUrl, {
                content,
                type: 'file',
                format: 'text'
            });

            this.refresh();
            
        } catch (error) {
            let errorMessage = 'Failed to save file to Jupyter Server.';
            if (axios.isAxiosError(error)) {
                errorMessage += ` Error: ${error.message}`;
                if (error.response) {
                    errorMessage += ` Status: ${error.response.status}`;
                    errorMessage += ` Data: ${JSON.stringify(error.response.data)}`;
                }
            } else {
                errorMessage += ` ${error}`;
            }
            vscode.window.showErrorMessage(errorMessage);
        }
    }

    public getAxiosInstance(): AxiosInstance | null {
        return this.axiosInstance;
    }

    watch(uri: vscode.Uri, options: { recursive: boolean; excludes: string[]; }): vscode.Disposable {
        return new vscode.Disposable(() => {});
    }

    stat(uri: vscode.Uri): vscode.FileStat {
        return {
            type: vscode.FileType.File,
            ctime: Date.now(),
            mtime: Date.now(),
            size: 0
        };
    }

    readDirectory(uri: vscode.Uri): [string, vscode.FileType][] | Thenable<[string, vscode.FileType][]> {
        throw vscode.FileSystemError.NoPermissions();
    }

    createDirectory(uri: vscode.Uri): void | Thenable<void> {
        throw vscode.FileSystemError.NoPermissions();
    }

    async readFile(uri: vscode.Uri): Promise<Uint8Array> {
        const content = await this.fetchFileContent(uri.path.slice(1));
        return Buffer.from(content);
    }

    async writeFile(uri: vscode.Uri, content: Uint8Array, options: { create: boolean; overwrite: boolean; }): Promise<void> {
        await this.saveFileToJupyter(uri.path.slice(1), content.toString());
        this._emitter.fire([{ type: vscode.FileChangeType.Changed, uri }]);
    }

    delete(uri: vscode.Uri, options: { recursive: boolean; }): void | Thenable<void> {
        throw vscode.FileSystemError.NoPermissions();
    }

    rename(oldUri: vscode.Uri, newUri: vscode.Uri, options: { overwrite: boolean; }): void | Thenable<void> {
        throw vscode.FileSystemError.NoPermissions();
    }
}

export class FileItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly collapsible: boolean,
        public readonly uri: string
    ) {
        super(label, collapsible ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None);
        this.tooltip = this.label;
        this.description = this.uri;

        if (!collapsible) {
            /*
            this.command = {
                command: 'jupyterFileExplorer.openFile',
                title: 'Open File',
                arguments: [this.uri]
            };
            */
            this.contextValue = 'fileItem'; // 컨텍스트 값 추가
        }
        else{
            this.contextValue = 'directoryItem'; // 컨텍스트 값 추가
        }
    }
}

export class JupyterContentProvider implements vscode.TextDocumentContentProvider {
    private axiosInstance: AxiosInstance | null = null;

    constructor(private fileExplorerProvider: FileExplorerProvider) {}

    setAxiosInstance(axiosInstance: AxiosInstance) {
        this.axiosInstance = axiosInstance;
    }

    async provideTextDocumentContent(uri: vscode.Uri, token: vscode.CancellationToken): Promise<string> {
        if (!this.axiosInstance) {
            throw new Error('Not connected to Jupyter Server.');
        }

        const filePath = uri.path;
        const apiUrl = `api/contents${filePath}`;

        try {
            const response = await this.axiosInstance.get(apiUrl);
            return response.data.content;
        } catch (error) {
            console.error('Failed to fetch file content:', error);
            throw new Error('Failed to fetch file content from Jupyter Server.');
        }
    }
}
