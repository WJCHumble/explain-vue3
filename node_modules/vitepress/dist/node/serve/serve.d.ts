export interface ServeOptions {
    root?: string;
    port?: number;
}
export declare function serve(options?: ServeOptions): Promise<void>;
