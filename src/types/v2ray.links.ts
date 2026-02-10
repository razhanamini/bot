export interface VlessLinkSet {
  standard: string;       // Default link (chrome fingerprint)
  android: string;        // Android link (ios fingerprint)
  ios: string;           // iOS link (ios fingerprint)
  linux: string;         // Linux link (chrome fingerprint)
  windows: string;       // Windows link (chrome fingerprint)
  macos: string;         // macOS link (firefox fingerprint)
  qrCodeAndroid?: string; // QR code data for Android
  qrCodeIos?: string;    // QR code data for iOS
  qrCodeWindows?: string; // QR code data for Windows
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

export class VlessLinkGenerator {
  static generateLinkSet(params: VlessLinkParams): VlessLinkSet {
    const links: VlessLinkSet = {
      standard: this.generateLink(params, 'chrome'),
      android: this.generateLink(params, 'ios'),      // Android uses ios fingerprint
      ios: this.generateLink(params, 'ios'),
      linux: this.generateLink(params, 'chrome'),
      windows: this.generateLink(params, 'chrome'),
      macos: this.generateLink(params, 'firefox'),
    };

    // Generate QR codes
    links.qrCodeAndroid = this.generateBase64QRCode(links.android);
    links.qrCodeIos = this.generateBase64QRCode(links.ios);
    links.qrCodeWindows = this.generateBase64QRCode(links.windows);

    return links;
  }

  private static generateLink(params: VlessLinkParams, fingerprint: string): string {
    const queryParams = new URLSearchParams();
    
    // Add required parameters
    queryParams.set('type', params.networkType);
    queryParams.set('security', params.security);
    queryParams.set('sni', params.sni);
    queryParams.set('pbk', params.publicKey);
    queryParams.set('sid', params.shortId);
    queryParams.set('fp', fingerprint);
    queryParams.set('encryption', params.encryption || 'none');
    
    // Add optional parameters
    if (params.flow) {
      queryParams.set('flow', params.flow);
    }

    const queryString = queryParams.toString();
    const encodedEmail = encodeURIComponent(params.email);
    
    return `vless://${params.uuid}@${params.serverHost}:${params.serverPort}?${queryString}#${encodedEmail}`;
  }

  private static generateBase64QRCode(link: string): string {
    // This is a placeholder - in production, you'd use a QR code library
    // For now, we'll return the link itself, but you should implement actual QR generation
    // using a library like 'qr-image' or 'qrcode'
    return link;
  }

  static formatForDisplay(links: VlessLinkSet): string {
    let message = '🔗 *Your V2Ray Configurations:*\n\n';
    
    message += '📱 *Android:*\n';
    message += `\`${links.android}\`\n\n`;
    
    message += '🍎 *iOS:*\n';
    message += `\`${links.ios}\`\n\n`;
    
    message += '🐧 *Linux:*\n';
    message += `\`${links.linux}\`\n\n`;
    
    message += '🪟 *Windows:*\n';
    message += `\`${links.windows}\`\n\n`;
    
    message += '🍏 *macOS:*\n';
    message += `\`${links.macos}\`\n\n`;
    
    message += '💡 *Usage Tip:* Copy the appropriate link for your device and import it into your V2Ray client.';
    
    return message;
  }

  static getPlatformLink(links: VlessLinkSet, platform: keyof VlessLinkSet): string|undefined {
    return links[platform];
  }
}