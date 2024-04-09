import UEngineBackend from './UEngineBackend';

class BackendFactory extends Window {
    static createBackend() {
        console.log((window as any).$mode);
        switch ((window as any).$mode) {
            case 'uengine':
                return new UEngineBackend();
            default:
                throw new Error('Invalid backend type');
        }
    }
}
export default BackendFactory;
