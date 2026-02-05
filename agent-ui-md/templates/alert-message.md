# 메시지 표시 (v-snackbar)

전역 `this.$try()`로 스낵바 메시지를 출력한다.

---

## 기본 사용법

```js
this.$try({
    action: async () => {
        // 비동기 처리
    },
    successMsg: this.$t('successMsg.xxx'),  // 성공
    errorMsg: this.$t('errorMsg.xxx'),      // 실패
    warningMsg: this.$t('warningMsg.xxx')   // 경고
});
```

---

## 메시지만 출력

```js
this.$try({
    action: async () => {},
    warningMsg: this.$t('Checkpoints.pleaseCheckAll')
});
```

---

## 옵션

| 옵션 | 설명 |
|------|------|
| `action` | 실행할 비동기 함수 (필수) |
| `successMsg` | 성공 시 스낵바 메시지 |
| `errorMsg` | 실패 시 스낵바 메시지 |
| `warningMsg` | 경고 스낵바 메시지 |
| `onFail` | 실패 시 추가 처리 함수 |
