export class UploadUnconfirmedError extends Error {}

// A resolved fetch alone does not prove a Sheet append. Require the GAS receipt
// for this exact record. text/plain keeps this a CORS simple request.
export async function submitTaskTimingRecord(endpoint, payload, { fetchImpl = fetch, timeoutMs = 90000 } = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const response = await fetchImpl(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
            body: JSON.stringify(payload),
            signal: controller.signal,
        });
        if (!response.ok || response.type === 'opaque') throw new UploadUnconfirmedError('No readable upload receipt');
        const receipt = await response.json();
        if (receipt.result !== 'success' || receipt.recordId !== payload.recordId || !Number.isInteger(receipt.row) || receipt.row < 2) {
            throw new UploadUnconfirmedError('Missing matching Sheet receipt');
        }
        return receipt;
    } catch (error) {
        if (error instanceof UploadUnconfirmedError) throw error;
        throw new UploadUnconfirmedError('Upload receipt unavailable', { cause: error });
    } finally {
        clearTimeout(timer);
    }
}

export async function submitTaskTimingBatch(endpoint, payloads, { onConfirmed = () => {}, ...options } = {}) {
    if (!payloads.length) throw new UploadUnconfirmedError('No records to upload');
    for (const payload of payloads) {
        await submitTaskTimingRecord(endpoint, payload, options);
        onConfirmed(payload);
    }
}
