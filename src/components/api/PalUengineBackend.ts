import UEngineBackend from './UEngineBackend';

/**
 * PAL + uEngine 전용 백엔드.
 * UEngineBackend를 상속하며, PAL UI와 uEngine API를 함께 쓸 때 사용한다.
 * PAL 전용 동작이 필요하면 여기서 메서드를 오버라이드하면 된다.
 */
class PalUengineBackend extends UEngineBackend {}

export default PalUengineBackend;
