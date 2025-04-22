import UEngineBackend from './UEngineBackend';
import ProcessGPTBackend from './ProcessGPTBackend';
import PalModeBackend from './PalModeBackend';

class BackendFactory extends Window {
    static createBackend() {
        try { 
            // console.log((window as any).$mode);
            if((window as any).$pal == true) {
                return new PalModeBackend();
            }
            switch ((window as any).$mode) {
                case 'uEngine':
                    return new UEngineBackend();
                case 'ProcessGPT':
                    return new ProcessGPTBackend();
                default:
                    throw new Error('Invalid backend type');
            }
        } catch (error) {
             console.error('백엔드 어댑터 초기화 실패:', error)
            throw new Error(`어댑터 초기화 실패: ${error.message}`)
        }
    }
}
export default BackendFactory;
