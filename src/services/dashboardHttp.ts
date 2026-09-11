import axios from 'axios';

// Each request uses the current session, including after token refresh.
export const dashboardHttp = axios.create();
dashboardHttp.interceptors.request.use(async (config) => {
    const supabase = (window as any).$supabase;
    if (!supabase) throw new Error('로그인 정보를 불러온 후 다시 시도해 주세요.');
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    if (!data.session) throw new Error('로그인 후 분석 대시보드를 이용해 주세요.');
    config.headers.Authorization = `Bearer ${data.session.access_token}`;
    return config;
});
