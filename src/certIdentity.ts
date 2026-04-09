export interface CertIdentityLike {
    code: string;
    url: string;
    title: string;
}

export const getCertIdentity = (cert: CertIdentityLike): string => {
    if (cert.code) return `cert:${cert.code}`;
    // Fallback: use title + normalized URL
    const normalizedUrl = cert.url.replace(/\/+$/, '').trim();
    return `fallback:${cert.title.trim()}|${normalizedUrl}`;
};
