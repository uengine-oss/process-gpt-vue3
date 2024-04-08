import UEngineBackend from './UEngineBackend';

class BackendFactory {
    static createBackend(backendType: string) {
        switch (backendType) {
            case 'uengine':
                return new UEngineBackend();
            default:
                throw new Error('Invalid backend type');
        }
    }
}
export default BackendFactory;
