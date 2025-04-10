class StorageBaseError extends Error {
    constructor(message, cause, args) {
        super(message, { cause: cause });

        this.args = args;
    }
}

export default class StorageBaseSupabase {
    //extends StorageBase{

    async isConnection() {
        try {
            let accessToken = "";
            let refreshToken = "";
           
            if (document.cookie && document.cookie.includes('; ')) {
                accessToken = document.cookie.split('; ').find(row => row.startsWith('access_token'))?.split('=')[1];
                refreshToken = document.cookie.split('; ').find(row => row.startsWith('refresh_token'))?.split('=')[1];
            }

            if (accessToken && refreshToken && accessToken.length > 0 && refreshToken.length > 0) {
                const { error: sessionError } = await window.$supabase.auth.setSession({
                    access_token: accessToken,
                    refresh_token: refreshToken
                });

                if (sessionError) {
                    const { data: refreshData, error: refreshError } = await window.$supabase.auth.refreshSession();
                    if (refreshError) {
                        console.error('Error refreshing session:', refreshError);
                        const cookieOptionsBase = `path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax`;
                        if (window.location.host.includes('process-gpt.io')) {
                            document.cookie = `access_token=; domain=.process-gpt.io; ${cookieOptionsBase}; Secure`;
                            document.cookie = `refresh_token=; domain=.process-gpt.io; ${cookieOptionsBase}; Secure`;
                        } else {
                            document.cookie = `access_token=; ${cookieOptionsBase}`;
                            document.cookie = `refresh_token=; ${cookieOptionsBase}`;
                        }
                        window.localStorage.removeItem('accessToken');
                        return false;
                    }

                    if (window.location.host.includes('process-gpt.io')) {
                        document.cookie = `access_token=${refreshData.session.access_token}; domain=.process-gpt.io; path=/; Secure; SameSite=Lax`;
                        document.cookie = `refresh_token=${refreshData.session.refresh_token}; domain=.process-gpt.io; path=/; Secure; SameSite=Lax`;
                    } else {
                        document.cookie = `access_token=${refreshData.session.access_token}; path=/; SameSite=Lax`;
                        document.cookie = `refresh_token=${refreshData.session.refresh_token}; path=/; SameSite=Lax`;
                    }
                    window.localStorage.setItem('accessToken', refreshData.session.access_token);
                }
            } else {
                const { data: refreshData, error: refreshError } = await window.$supabase.auth.refreshSession();
                if (refreshError) {
                    console.error('Error refreshing session (no initial tokens):', refreshError);
                    const cookieOptionsBase = `path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax`;
                    if (window.location.host.includes('process-gpt.io')) {
                        document.cookie = `access_token=; domain=.process-gpt.io; ${cookieOptionsBase}; Secure`;
                        document.cookie = `refresh_token=; domain=.process-gpt.io; ${cookieOptionsBase}; Secure`;
                    } else {
                        document.cookie = `access_token=; ${cookieOptionsBase}`;
                        document.cookie = `refresh_token=; ${cookieOptionsBase}`;
                    }
                    window.localStorage.removeItem('accessToken');
                    return false;
                } else {
                    if (window.location.host.includes('process-gpt.io')) {
                        document.cookie = `access_token=${refreshData.session.access_token}; domain=.process-gpt.io; path=/; Secure; SameSite=Lax`;
                        document.cookie = `refresh_token=${refreshData.session.refresh_token}; domain=.process-gpt.io; path=/; Secure; SameSite=Lax`;
                    } else {
                        document.cookie = `access_token=${refreshData.session.access_token}; path=/; SameSite=Lax`;
                        document.cookie = `refresh_token=${refreshData.session.refresh_token}; path=/; SameSite=Lax`;
                    }
                    window.localStorage.setItem('accessToken', refreshData.session.access_token);
                }
                
            }
            
            const { data, error } = await window.$supabase.auth.getUser();
            if (error) {
                return false;
            }
            if (data) {
                this.writeUserData(data);
                return true;
            }
        } catch (error) {
            console.error('Error checking Supabase connection:', error);
            return false;
        }
    }

    async checkTenantOwner(tenantId) {
        try {
            const data = await this.getObject(`tenants/${tenantId}`, { key: 'id' });
            if (data && data.owner) {
                const user = await this.getUserInfo();
                if (data.owner == user.uid) {
                    return true;
                }
            } else {
                return false;
            }
        } catch (e) {
            throw new StorageBaseError('error in checkTenantOwner', e, arguments);
        }
    }

    async signIn(userInfo) {
        try {
            const existUser = await this.getObject('users', { match: { email: userInfo.email } });
            if ((window.$isTenantServer && !window.$tenantName) ||
                (existUser && existUser.tenants && existUser.tenants.includes(window.$tenantName))
            ) {
                const result = await window.$supabase.auth.signInWithPassword({
                    email: userInfo.email,
                    password: userInfo.password
                });

                if (!result.error) {
                    // 로그인 성공
                    return result.data;
                } else if (result.error && result.error.message.includes("Email not confirmed")){
                    result.errorMsg = "계정 인증이 완료되지 않았습니다. 이메일 확인 후 다시 로그인하세요."
                    return result;
                } else {
                    const users = await this.list('users');
                    if (users && users.length > 0) {
                        const checkedId = users.some((user) => user.email == userInfo.email);
                        if (checkedId) {
                                result.errorMsg = '비밀번호가 틀렸습니다.';
                        } else {
                            result.errorMsg = '아이디가 틀렸습니다.';
                        }
                        return result;
                    } else {
                        throw new StorageBaseError(result.error);
                    }
                }
            } else {
                return {
                    error: true,
                    errorMsg: '회원가입이 필요합니다.'
                }
                // throw new StorageBaseError('error in signIn', e, arguments);
            }
        } catch (e) {
            throw new StorageBaseError('error in signIn', e, arguments);
        }
    }
    async signInWithKeycloak() {
        try {
            const { data, error } = await window.$supabase.auth.signInWithOAuth({
                provider: 'keycloak',
                options: {
                    scopes: 'openid'
                }
            });
        } catch (e) {
            throw new StorageBaseError('error in signInWithKeycloak', e, arguments);
        }
    }
    async signUp(userInfo) {
        try {
            const tenantId = window.$tenantName || 'process-gpt';
            const existUser = await this.getObject('users', { match: { email: userInfo.email } });
            if (existUser && existUser.id) {
                var tenants = existUser.tenants || [];
                if (!tenants.includes(tenantId)) {
                    tenants.push(tenantId);
                }
                existUser.tenants = tenants;
                await this.putObject('users', {
                    id: existUser.id,
                    tenants: tenants,
                    current_tenant: tenantId
                }, { onConflict: 'id' });
                return await this.signIn(userInfo);
            } else {
                const result = await window.$supabase.auth.signUp({
                    email: userInfo.email,
                    password: userInfo.password,
                    options: {
                        data: {
                            name: userInfo.username
                        }
                    }
                });

                if (!result.error) {
                    if (!window.$isTenantServer && window.$tenantName) {
                        const existTenant = await this.getObject('tenants', { match: { id: window.$tenantName } });
                        if (!existTenant) {
                            await this.putObject('tenants', {
                                id: window.$tenantName,
                                owner: result.data.user.id
                            });
                        }
                        const role = existTenant ? 'user' : 'superAdmin';
                        const isAdmin = existTenant ? false : true;
                        await this.putObject('users', {
                            id: result.data.user.id,
                            username: userInfo.username,
                            email: userInfo.email,
                            role: role,
                            is_admin: isAdmin,
                            tenants: [window.$tenantName],
                            current_tenant: window.$tenantName
                        });
                    }
                    result.data["isNewUser"] = true;
                    return result.data;
                } else {
                    result.errorMsg = result.error.message;
                    return result;
                }
            }
        } catch (e) {
            throw new StorageBaseError('error in signUp', e, arguments);
        }
    }

    async signOut() {
        try {
            window.localStorage.removeItem('accessToken');
            window.localStorage.removeItem('author');
            window.localStorage.removeItem('userName');
            window.localStorage.removeItem('email');
            window.localStorage.removeItem('picture');
            window.localStorage.removeItem('uid');
            window.localStorage.removeItem('isAdmin');
            window.localStorage.removeItem('execution');
            window.localStorage.removeItem('role');
            
            if (window.location.host.includes('process-gpt.io')) {
                document.cookie = 'access_token=; domain=.process-gpt.io; path=/';
                document.cookie = 'refresh_token=; domain=.process-gpt.io; path=/';
            } else {
                document.cookie = 'access_token=; path=/';
                document.cookie = 'refresh_token=; path=/';
            }

            return await window.$supabase.auth.signOut();
        } catch (e) {
            throw new StorageBaseError('error in signOut', e, arguments);
        }
    }

    async getUserInfo() {
        try {
            if (await this.isConnection()) {
                const userData = await window.$supabase.auth.getUser();
                if (userData.error) {
                    throw new StorageBaseError('error in getUserInfo', userData.error, arguments);
                } else if (userData.data.user) {
                    const uid = userData.data.user.id;
                    var { data, error } = await window.$supabase.from('users').select().eq('id', uid).maybeSingle();
                    if (!error && data) {
                        return {
                            email: data.email,
                            name: data.username,
                            profile: data.profile,
                            uid: data.id,
                            role: data.role,
                            tenants: data.tenants,
                            current_tenant: data.current_tenant
                        }
                    } else if (error) {
                        throw new StorageBaseError('error in getUserInfo', error, arguments);
                    }
                }
            } else {
                if (window.location.pathname != '/auth/login') {
                    alert('로그인이 필요합니다.');
                    window.location.href = '/auth/login';
                }
            }
        } catch (e) {
            if (e instanceof StorageBaseError && e.cause) {
                console.error('Error in getUserInfo:', e.cause);
            } else {
                console.error('Unexpected error in getUserInfo:', e);
            }
            throw new StorageBaseError('error in getUserInfo', e, arguments);
        }
    }

    async resetPassword(email) {
        try {
            let url;
            if (window.location.host.includes('process-gpt.io')) {
                url = 'https://process-gpt.io/auth/reset-password';
            } else {
                url = window.location.origin + '/auth/reset-password';
            }
            const result = await window.$supabase.auth.resetPasswordForEmail(email, {
                redirectTo: url,
            });
            return result;
        } catch (e) {
            throw new StorageBaseError('error in resetPassword', e, arguments);
        }
    }

    async getString(path, options) {
        try {
            let obj = this.formatDataPath(path, options);
            const column = options.column ? options.column : "*";
            if (options && options.match) {
                const { data, error } = await window.$supabase
                    .from(obj.table)
                    .select(column)
                    .match(options.match)
                    .maybeSingle()

                if (error) {
                    return error;
                } else if (data) {
                    if (column != "*") {
                        return data[column];
                    } else {
                        return data;
                    }
                }
            } else if (obj.searchVal) {
                const { data, error } = await window.$supabase
                    .from(obj.table)
                    .select(column)
                    .eq(obj.searchKey, obj.searchVal)
                    .maybeSingle()

                if (error) {
                    return error;
                } else if (data) {
                    if (column != "*") {
                        return data[column];
                    } else {
                        return data;
                    }
                }
            } else {
                const { data, error } = await window.$supabase
                    .from(obj.table)
                    .select(column)
                    .maybeSingle()

                if (error) {
                    return error;
                } else if (data) {
                    if (column != "*") {
                        return data[column];
                    } else {
                        return data;
                    }
                }
            }
        } catch (error) {
            if (error.code === 'PGRST116' || error.code === '42703') {
                console.log(error.message);
                return "";
            }
            throw new StorageBaseError('error in getString', error, arguments)
        }
    }

    async getObject(path, options) {
        try {
            let obj = this.formatDataPath(path, options);
            if (options && options.match) {
                const { data, error } = await window.$supabase
                    .from(obj.table)
                    .select()
                    .match(options.match)
                    .maybeSingle()

                if (error) {
                    return error;
                } else if (data) {
                    return data;
                }
            } else if (obj.searchVal) {
                const { data, error } = await window.$supabase
                    .from(obj.table)
                    .select()
                    .eq(obj.searchKey, obj.searchVal)
                    .maybeSingle()

                if (error) {
                    return error;
                } else if (data) {
                    return data;
                }
            } else {
                const { data, error } = await window.$supabase
                    .from(obj.table)
                    .select()
                    .maybeSingle()

                if (error) {
                    return error;
                } else if (data) {
                    return data;
                }
            }
        } catch (error) {
            if (error.code === 'PGRST116' || error.code === '42703') {
                console.log(error.message);
                return {};
            } else {
                throw new StorageBaseError('error in getObject', error.message)
            }
        }
    }

    // PUT
    async putString(path, value, options) {
        try {
            let obj = this.formatDataPath(path, options);
            if (options && options.match) {
                const { error } = await window.$supabase.from(obj.table).upsert(value).match(options.match);

                if (error) {
                    throw new StorageBaseError('error in putString' + error.message, error, arguments);
                }
            } else if (options && options.onConflict) {
                const { error } = await window.$supabase.from(obj.table).upsert(value, { onConflict: options.onConflict });
                if (error) {
                    throw new StorageBaseError('error in putString' + error.message, error, arguments);
                }
            } else if (obj.searchVal) {
                const { error } = await window.$supabase.from(obj.table).upsert(value).eq(obj.searchKey, obj.searchVal);

                if (error) {
                    throw new StorageBaseError('error in putString' + error.message, error, arguments);
                }
            } else {
                const { error } = await window.$supabase.from(obj.table).upsert(value);

                if (error) {
                    throw new StorageBaseError('error in putString' + error.message, error, arguments);
                }
            }
        } catch (error) {
            throw new StorageBaseError('error in putString', error, arguments);
        }
    }

    async putObject(path, value, options) {
        try {
            let obj = this.formatDataPath(path, options);
            let result;
            if (options && options.match) {
                result = await window.$supabase.from(obj.table).upsert(value).match(options.match);

            } else if (obj.searchVal) {
                result = await window.$supabase.from(obj.table).upsert(value).eq(obj.searchKey, obj.searchVal);
            } else {
                result = await window.$supabase.from(obj.table).upsert(value);

            }

            const { error, status, statusText } = result
            if (status != 200 && error) {
                throw new StorageBaseError('error in putObject:' + status + " " + statusText + " " + error.message, error, arguments);
            }
        } catch (error) {
            throw new StorageBaseError('error in putObject', error, arguments);
        }
    }

    // PUSH
    async pushString(path, value, options) {
        try {
            let obj = this.formatDataPath(path, options);
            if (options && options.match) {
                const { error } = await window.$supabase.from(obj.table).upsert(value).match(options.match);

                if (error) {
                    throw new StorageBaseError('error in pushString', error, arguments);
                }
            } else if (obj.searchVal) {
                const { error } = await window.$supabase.from(obj.table).upsert(value).eq(obj.searchKey, obj.searchVal);

                if (error) {
                    throw new StorageBaseError('error in pushString', error, arguments);
                }
            } else {
                const { error } = await window.$supabase.from(obj.table).upsert(value);

                if (error) {
                    throw new StorageBaseError('error in pushString', error, arguments);
                }
            }
        } catch (error) {
            throw new Error('error in pushString', { cause: error, args: arguments });
        }
    }

    async pushObject(path, value, options) {
        try {
            let obj = this.formatDataPath(path, options);
            if (options && options.match) {
                const { error } = await window.$supabase.from(obj.table).upsert(value).match(options.match);

                if (error) {
                    throw new StorageBaseError('error in pushObject', error, arguments);
                }
            } else if (obj.searchVal) {
                const { error } = await window.$supabase.from(obj.table).upsert(value).eq(obj.searchKey, obj.searchVal);

                if (error) {
                    throw new StorageBaseError('error in pushObject', error, arguments);
                }
            } else {
                const { error } = await window.$supabase.from(obj.table).upsert(value);

                if (error) {
                    throw new StorageBaseError('error in pushObject', error, arguments);
                }
            }
        } catch (error) {
            throw new StorageBaseError('error in pushObject', error, arguments);
        }
    }

    // DELETE
    async delete(path, options) {
        try {
            let obj = this.formatDataPath(path, options);
            if (options && options.match) {
                const { error, status, statusText } = await window.$supabase
                    .from(obj.table)
                    .delete()
                    .match(options.match);

                if (error && status != 200) {
                    throw new StorageBaseError('error in delete ' + status + " " + statusText, error, arguments);
                }
            } else if (obj.searchVal) {
                const { error, status, statusText } = await window.$supabase.from(obj.table).delete().eq(obj.searchKey, obj.searchVal);

                if (error && status != 200) {
                    throw new StorageBaseError('error in delete ' + status + " " + statusText, error, arguments);
                }
            }

            return false;
        } catch (error) {
            throw new StorageBaseError('error in delete', error, arguments);
        }
    }

    async watch(path, callback) {
        try {
            let obj = this.formatDataPath(path);
            await window.$supabase
                .channel('room1')
                .on(
                    'postgres_changes',
                    {
                        event: '*',
                        schema: 'public',
                        table: obj.table
                    },
                    (payload) => {
                        console.log('Change received!', payload);
                        callback(payload);
                    }
                )
                .subscribe();

        } catch (error) {
            throw new StorageBaseError('error in watch', error, arguments);
        }
    }

    async watch_added(path, callback) {
        try {
            let obj = this.formatDataPath(path);
            await window.$supabase
                .channel('room1')
                .on(
                    'postgres_changes',
                    {
                        event: '*',
                        schema: 'public',
                        table: obj.table
                    },
                    (payload) => {
                        console.log('Change received!', payload);
                        callback(payload);
                    }
                )
                .subscribe();
        } catch (error) {
            throw new StorageBaseError('error in watch_added', error, arguments);
        }
    }

    async unwatch(path) {
        try {
            let obj = this.formatDataPath(path);
            const subscription = window.$supabase
                .channel('room1')
                .on(
                    'postgres_changes',
                    {
                        event: '*',
                        schema: 'public',
                        table: obj.table
                    },
                    (payload) => {
                        console.log('Change received!', payload);
                    }
                );

            await subscription.unsubscribe();

            console.log(`Unsubscribed from changes on ${obj.table}`);
        } catch (error) {
            throw new StorageBaseError('error in unwatch', error, arguments);
        }
    }

    async list(path, options) {
        try {
            // options: {
            //     key: 'key:value' // default key:'orderBy:Field'  First filtering
            //     sort: "desc", // default "asc"
            //     orderBy: 'when',
            //     size: 10,
            //     startAt: orderBy key contains values
            //     endAt: orderBy key contains values
            //     startAfter:  orderBy key then value
            //     endBefore: orderBy key then value
            //     snapshot: true // return snapshot
            // }

            if (!options) options = {};
            const orderByField = options.orderBy || 'id';
            const isAscending = !options.sort || !options.sort.includes('desc');
            let query = window.$supabase.from(path);
            // let obj = this.formatDataPath(path, options);
            // let query = window.$supabase.from(obj.table)

            // key 처리 - 컬럼명
            if (options.key) {
                query = query.select(options.key);
            } else {
                query = query.select();
            }

            // orderBy 처리
            if (options.orderBy) {
                query = query.order(orderByField, { ascending: isAscending });
            }

            // 범위 쿼리 처리
            if (options.startAt && !options.endAt && !options.endBefore) {
                query = query.gte(orderByField, options.startAt);
            } else if (options.startAt && options.endAt) {
                if (options.startAt == options.endAt) {
                    query = query.eq(orderByField, options.startAt);
                } else {
                    query = query.gte(orderByField, options.startAt).lte(orderByField, options.endAt);
                }
            } else if (options.endAt && !options.startAt && !options.startAfter) {
                query = query.lte(orderByField, options.endAt);
            } else if (options.startAfter && !options.endBefore && !options.endAt) {
                query = query.gt(orderByField, options.startAfter);
            } else if (options.startAfter && options.endBefore) {
                if (options.startAfter == options.endBefore) {
                    query = query.eq(orderByField, options.startAfter);
                } else {
                    query = query.gt(orderByField, options.startAfter).lt(orderByField, options.endBefore);
                }
            } else if (options.endBefore && !options.startAfter && !options.startAt) {
                query = query.lt(orderByField, options.endBefore);
            } else if (options.startAt && options.endBefore && !options.endAt) {
                query = query.gte(orderByField, options.startAt).lt(orderByField, options.endBefore);
            } else if (options.startAfter && options.endAt && !options.startAt) {
                query = query.gt(orderByField, options.startAfter).lte(orderByField, options.endAt);
            }

            // like 처리
            if (options.like) {
                query = query.like(orderByField, options.like);
            }

            // 일치 처리
            if (options.match) {
                query = query.match(options.match);
            }

            // size 처리
            if (options.size) {
                query = query.limit(options.size);
            }

            const { data, error } = await query;
            if (error) {
                return error;
            } else {
                return data;
            }
        } catch (error) {
            throw new StorageBaseError('error in list', error, arguments);
        }
    }

    async writeUserData(value, userInfo) {
        try {
            if (value.session) {
                window.localStorage.setItem('accessToken', value.session.access_token);
                if (window.location.host.includes('process-gpt.io')) {
                    document.cookie = `access_token=${value.session.access_token}; domain=.process-gpt.io; path=/; Secure; SameSite=Lax`;
                    document.cookie = `refresh_token=${value.session.refresh_token}; domain=.process-gpt.io; path=/; Secure; SameSite=Lax`;
                } else {
                    document.cookie = `access_token=${value.session.access_token}; path=/; SameSite=Lax`;
                    document.cookie = `refresh_token=${value.session.refresh_token}; path=/; SameSite=Lax`;
                }
            }
            if (value.user) {
                window.localStorage.setItem('author', value.user.email);
                window.localStorage.setItem('uid', value.user.id);

                const { data, error } = await window.$supabase
                    .from('users')
                    .select('*')
                    .eq('id', value.user.id)
                    .maybeSingle();

                if (!error) {
                    window.localStorage.setItem('isAdmin', data.is_admin);
                    window.localStorage.setItem('picture', data.profile);
                    if (data.role && data.role !== '') {
                        window.localStorage.setItem('role', data.role);
                    }
                    window.localStorage.setItem('userName', data.username);
                    window.localStorage.setItem('email', data.email);
                    window.localStorage.setItem('uid', data.id);
                }
            }
        } catch (e) {
            throw new StorageBaseError('error in writeUserData', e, arguments);
        }
    }

    formatDataPath(path, options) {
        try {
            path = path.includes('://') ? path.split('://')[1] : path;
            let obj = {
                table: ''
            };

            if (path.includes('/')) {
                obj.table = path.split('/')[0];
                if (options && options.key) {
                    obj.searchKey = options.key;
                    obj.searchVal = path.split('/')[1];
                }
            } else {
                obj.table = path;
            }

            return obj;
        } catch (error) {
            throw new StorageBaseError('error in formatDataPath', error, arguments);
        }
    }

    async getCount(path, options) {
        try {
            let obj = this.formatDataPath(path, options);
            if (options && options.match) {
                const { count, error } = await window.$supabase.from(obj.table).select('*', { count: 'exact' }).match(options.match);

                if (error) {
                    return error;
                } else {
                    return count;
                }
            } else if (obj.searchVal) {
                const { count, error } = await window.$supabase
                    .from(obj.table)
                    .select('*', { count: 'exact' })
                    .eq(obj.searchKey, obj.searchVal);

                if (error) {
                    return error;
                } else {
                    return count;
                }
            } else {
                const { count, error } = await window.$supabase.from(obj.table).select('*', { count: 'exact' });

                if (error) {
                    return error;
                } else {
                    return count;
                }
            }
        } catch (error) {
            throw new StorageBaseError('error in getCount', error, arguments);
        }
    }

    async callProcedure(procedure, params) {
        try {
            const { data, error } = await window.$supabase.rpc(procedure, params);

            if (error) {
                console.error('Error calling function:', error);
                return null;
            }

            return data;
        } catch (error) {
            console.error('Error in callProcedure:', error);
            return error;
        }
    }

    async search(keyword) {
        let results = [];
        if (window.$jms || window.$pal) {
            results = await Promise.all([
                this.searchProcDef(keyword)
            ]);
        } else {
            results = await Promise.all([
                this.searchProcInst(keyword),
                this.searchProcDef(keyword),
                this.searchChatRoom(keyword),
                this.searchChat(keyword)
            ]);
        }
        results = results.filter(item => item !== null);
        return results;
    }

    async searchProcInst(keyword) {
        try {
            const email = window.localStorage.getItem('email');
            const data = await this.callProcedure('search_bpm_proc_inst', {
                keyword,
                user_email: email
            });

            if (data && data.length > 0) {
                const list = data.map((item) => {
                    const matchingColumns = [];
                    if (item.proc_inst_id && item.proc_inst_id.toLowerCase().includes(keyword.toLowerCase())) {
                        matchingColumns.push(item.proc_inst_id);
                    }
                    if (item.proc_inst_name && item.proc_inst_name.toLowerCase().includes(keyword.toLowerCase())) {
                        matchingColumns.push(item.proc_inst_name);
                    }
                    if (item.variables_data && JSON.stringify(item.variables_data).toLowerCase().includes(keyword.toLowerCase())) {
                        matchingColumns.push(JSON.stringify(item.variables_data));
                    }
                    return {
                        title: item.proc_inst_name,
                        href: `/instancelist/${btoa(item.proc_inst_id)}`,
                        matches: matchingColumns
                    };
                });
                if (list.length > 0) {
                    return {
                        type: 'instance',
                        header: '프로세스 인스턴스',
                        list: list
                    };
                }
            }
            return null;
        } catch (error) {
            return null;
        }
    }

    async searchProcDef(keyword) {
        try {
            const keyword1 = keyword.charAt(0);
            const { data, error } = await window.$supabase.from('proc_def')
                .select()
                .or(`id.ilike.%${keyword1}%,name.ilike.%${keyword1}%,bpmn.ilike.%${keyword1}%`);
            var formatData = data;
            for (var i = 1; i < keyword.length; i++) {
                formatData.push(formatData.filter(item => 
                    keyword.charAt(i) != ' ' &&(
                    item.id.toLowerCase().indexOf(keyword.charAt(i).toLowerCase()) > -1) ||
                    item.name.toLowerCase().indexOf(keyword.charAt(i).toLowerCase()) > -1 ||
                    item.bpmn.toLowerCase().indexOf(keyword.charAt(i).toLowerCase()) > -1) 
                );
            }

            if (error) throw new StorageBaseError('error in searchProcDef', error, arguments);

            if (formatData && formatData.length > 0) {
                const list = formatData.map((item) => {
                    const matchingColumns = [];
                    for (var i = 0; i < keyword.length; i++) {
                        if(keyword.charAt(i) == ' '){
                            continue;
                        }
                        if (item.id && item.id.toLowerCase().includes(keyword.charAt(i).toLowerCase())) {
                            matchingColumns.push(item.id);
                        }
                        if (item.name && item.name.toLowerCase().includes(keyword.charAt(i).toLowerCase())) {
                            matchingColumns.push(item.name);
                        }
                        if (item.bpmn && item.bpmn.toLowerCase().includes(keyword.charAt(i).toLowerCase())) {
                            matchingColumns.push(item.bpmn);
                        }
                    }
                    return {
                        title: item.name,
                        href: `/definitions/${item.id}`,
                        matches: matchingColumns
                    };
                });
                if (list.length > 0) {
                    return {
                        type: 'definition',
                        header: '프로세스 정의',
                        list: list
                    };
                }
            }
            return null;
        } catch (error) {
            return null;
        }
    }

    async searchFormDef(keyword) {
        try {
            const { data, error } = await window.$supabase.from('form_def')
                .select()
                .ilike('id', `%${keyword}%`);

            if (error) throw new StorageBaseError('error in searchFormDef', error, arguments);

            if (data && data.length > 0) {
                const list = data.map((item) => {
                    const matchingColumns = [];
                    if (item.id && item.id.toLowerCase().includes(keyword.toLowerCase())) {
                        matchingColumns.push(item.id);
                    }
                    return {
                        title: item.id,
                        href: `/ui-definitions/${item.id}`,
                        matches: matchingColumns
                    };
                });
                if (list.length > 0) {
                    return {
                        type: 'form',
                        header: '화면 정의',
                        list: list
                    };
                }
            }
            return null;
        } catch (error) {
            return null;
        }
    }

    async searchChatRoom(keyword) {
        try {
            const email = window.localStorage.getItem('email');
            const { data, error } = await window.$supabase.from('chat_rooms')
                .select()
                .or(`name.ilike.%${keyword}%`)

            if (error) throw new StorageBaseError('error in searchChat', error, arguments);

            const filteredData = data.filter(item => item.participants.some(participant => participant.email === email));
            if (filteredData && filteredData.length > 0) {
                const list = filteredData.map((item) => {
                    const matchingColumns = [item.participants.map(user => user.username).join(', ')]
                    return {
                        title: item.name,
                        href: `/chats?id=${item.id}`,
                        matches: matchingColumns
                    };
                });
                if (list.length > 0) {
                    return {
                        type: 'chat-room',
                        header: '채팅방',
                        list: list
                    };
                }
            }
            return null;
        } catch (error) {
            return null;
        }
    }

    async searchChat(keyword) {
        try {
            const data = await this.callProcedure('search_chat_room_chats', { keyword: keyword });

            if (data && data.length > 0) {
                let list = data.map((item) => {
                    const email = window.localStorage.getItem('email');
                    if (item.participants && item.participants.some(participant => participant.email === email)) {
                        const matchingColumns = [`${item.messages.name}: ${item.messages.content}`];
                        return {
                            title: item.name,
                            href: `/chats?id=${item.id}`,
                            matches: matchingColumns
                        };
                    } else {
                        return null
                    }
                });
                list = list.filter(item => item !== null);
                if (list.length > 0) {
                    return {
                        type: 'chat',
                        header: '채팅 메시지',
                        list: list
                    };
                }
            }
            return null;
        } catch (error) {
            return null;
        }
    }

    async uploadImage(fileName, image) {
        try {
            const { data, error } = await window.$supabase.storage.from('chat-images').upload(fileName, image);

            if (error) {
                return error;
            }

            return data;

        } catch (error) {
            throw new StorageBaseError('error in uploadImage', error, arguments);
        }
    }

    async getImageUrl(path) {
        try {
            const { data, error } = await window.$supabase.storage.from('chat-images').getPublicUrl(path);

            if (error) {
                return error;
            }

            return data.publicUrl;

        } catch (error) {
            throw new StorageBaseError('error in getImageUrl', error, arguments);
        }
    }

    async uploadFile(fileName, file) {
        try {
            const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
            const { data, error } = await window.$supabase.storage.from('files').upload(sanitizedFileName, file);

            if (error) {
                return error;
            }

            return data;
        } catch (error) {
            throw new StorageBaseError('error in uploadFile', error, arguments);
        }
    }

    async getFileUrl(path) {
        try {
            const { data, error } = await window.$supabase.storage.from('files').getPublicUrl(path);

            if (error) {
                return error;
            }

            return data.publicUrl;
        } catch (error) {
            throw new StorageBaseError('error in getFileUrl', error, arguments);
        }
    }
}
