export interface VlessLinkSet {
    standard: string;
    android: string;
    ios: string;
    linux: string;
    windows: string;
    macos: string;
    qrCodeAndroid?: string;
    qrCodeIos?: string;
    qrCodeWindows?: string;
}
export interface VlessLinkParams {
    uuid: string;
    serverHost: string;
    serverPort: number;
    email: string;
    security: string;
    sni: string;
    publicKey: string;
    shortId: string;
    networkType: string;
    flow?: string;
    encryption?: string;
}
export declare class VlessLinkGenerator {
    static escapeMarkdown(text: string): string;
    static generateLinkSet(params: VlessLinkParams): VlessLinkSet;
    private static generateLink;
    private static generateBase64QRCode;
    static formatForDisplay(links: VlessLinkSet): string;
    static getPlatformLink(links: VlessLinkSet, platform: keyof VlessLinkSet): string | undefined;
}
//# sourceMappingURL=v2ray.links.d.ts.map