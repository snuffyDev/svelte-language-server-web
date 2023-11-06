import { VFS } from "../vfs";
import { batchUpdates } from "../utils";

class TypedBroadcastChannel<T> extends BroadcastChannel {
  constructor(name: string) {
    super(name);
  }
  postMessage(message: T): void {
    super.postMessage(message);
  }
  onmessage: (message: MessageEvent<T>) => void;
  addEventListener: (
    type: "message",
    listener: (message: MessageEvent<T>) => void
  ) => void = super.addEventListener;
}

type File = [name: string, contents: string];
const BC = new TypedBroadcastChannel<File[]>("sync-channel");

function removeDuplicateFiles(files: File[]): File[] {
  const fileMap = new Map<string, File>();

  for (const [name, contents] of files) {
    // Only store the latest entry for each filename
    fileMap.set(name, [name, contents]);
  }

  return Array.from(fileMap.values());
}

export const syncFiles = batchUpdates<File[]>(
  (...files) => {
    BC.postMessage(removeDuplicateFiles(files));
  },
  50,
  50
);

export const handleFSSync = (
  callback: (fileName: string, contents: string) => void
) => {
  const cb = batchUpdates<File[]>((...data) => {
    console.log({ data });
    for (const file of data) {
      for (const [name, contents] of file) {
        VFS.writeFile(name, contents);
        callback(VFS.normalize(name), contents);
      }
    }
  });
  BC.onmessage = ({ data }) => cb(...data.values());
};

class Workspace {
  static instance: Workspace;

  static getInstance(): Workspace {
    if (!Workspace.instance) {
      Workspace.instance = new Workspace();
    }
    return Workspace.instance;
  }

  private constructor() {}

  public notifyFileChanges = syncFiles;
  public onFileChanges = handleFSSync;

  public updateFile = (name: string, contents: string) => {
    syncFiles(name, contents);
  };

  public getFile = (name: string) => {
    return VFS.readFile(name, "utf-8");
  };
}

export const workspace = Workspace.getInstance();
