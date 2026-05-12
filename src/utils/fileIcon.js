// Maps a MIME type to a display icon + color (Vuetify / MDI).

export function mimeIcon(mimeType) {
    const mt = (mimeType || '').toLowerCase();

    if (mt === 'application/pdf') {
        return { icon: 'mdi-file-pdf-box', color: 'red' };
    }
    if (mt === 'application/msword' || mt === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
        return { icon: 'mdi-file-word-box', color: 'blue' };
    }
    if (mt === 'application/vnd.ms-excel' || mt === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') {
        return { icon: 'mdi-file-excel-box', color: 'green' };
    }
    if (mt === 'application/vnd.ms-powerpoint' || mt === 'application/vnd.openxmlformats-officedocument.presentationml.presentation') {
        return { icon: 'mdi-file-powerpoint-box', color: 'orange' };
    }
    if (mt === 'application/x-hwp' || mt === 'application/vnd.hancom.hwpx' || mt === 'application/haansofthwp') {
        return { icon: 'mdi-file-document-outline', color: 'indigo' };
    }
    if (mt === 'text/markdown') {
        return { icon: 'mdi-language-markdown-outline', color: 'grey-darken-1' };
    }
    if (mt === 'text/plain') {
        return { icon: 'mdi-file-document-outline', color: 'grey' };
    }
    if (mt.startsWith('image/')) {
        return { icon: 'mdi-file-image-box', color: 'purple' };
    }
    if (mt.startsWith('video/')) {
        return { icon: 'mdi-file-video-box', color: 'pink' };
    }
    if (mt.startsWith('audio/')) {
        return { icon: 'mdi-file-music-box', color: 'teal' };
    }
    if (mt === 'application/zip' || mt === 'application/x-rar-compressed' || mt === 'application/x-7z-compressed') {
        return { icon: 'mdi-folder-zip-outline', color: 'brown' };
    }
    return { icon: 'mdi-file-outline', color: 'grey' };
}
