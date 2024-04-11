import UEngineBackend from './UEngineBackend';
import ProcessGPTBackend from './ProcessGPTBackend';

class BackendFactory extends Window {
    static createBackend() {
        console.log((window as any).$mode);
        switch ((window as any).$mode) {
            case 'uengine':
                return new UEngineBackend();
            case 'ProcessGPT':
                return new ProcessGPTBackend();
            default:
                throw new Error('Invalid backend type');
        }
    }
}
export default BackendFactory;
