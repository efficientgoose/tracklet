declare module 'node:test' {
  const test: (name: string, fn: (...args: any[]) => any) => void;
  export default test;
}

declare module 'node:assert/strict' {
  const assert: any;
  export default assert;
}

declare module 'node:fs' {
  const fs: any;
  export default fs;
}

interface TauriCore {
  invoke: (command: string, args?: Record<string, unknown>) => Promise<any>;
}

interface TauriGlobal {
  core: TauriCore;
}

interface Window {
  __TAURI__?: TauriGlobal;
}
