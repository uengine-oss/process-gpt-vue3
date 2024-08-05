import axios from 'axios';
// import StorageBase from "./StorageBase";
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
            const { data, error } = await window.$supabase.from('users').select().limit(1);
            if (error) {
                console.error('Supabase connection error:', error);
                return false;
            }
            if (data) {
                console.log('Supabase is connected.');
                return true;
            }
        } catch (error) {
            console.error('Error checking Supabase connection:', error);
            return false;
        }
    }

    async signIn(userInfo) {
        try {
            const result = await window.$supabase.auth.signInWithPassword({
                email: userInfo.email,
                password: userInfo.password
            });
            if (!result.error) {
                return result.data;
            } else if(result.error && result.error.message.includes("Email not confirmed")){
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
    
        } catch(e) {
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
        } catch(e) {
            throw new StorageBaseError('error in signInWithKeycloak', e, arguments);
        }
    }
    async signUp(userInfo) {
        try {
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
                return result.data;
            } else {
                result.errorMsg = result.error.message;
                return result;
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
            return await window.$supabase.auth.signOut();            
        } catch(e) {
            throw new StorageBaseError('error in signOut', e, arguments);
        }
    }

    async createUser(userInfo) {
        try {
            const result = await window.$supabase.auth.admin.createUser({
                email: userInfo.email, 
                password: userInfo.password,
                options: {
                    data: {
                        name: userInfo.username,
                    }
                }
            });
    
            if (!result.error) {
                return result.data;
            } else {
                throw new StorageBaseError(result.error);
            }
        } catch(e) {
            throw new StorageBaseError('error in createUser', e, arguments);
        }
    }

    async getUserInfo() {
        try {
            const uid = window.localStorage.getItem("uid");
            var { data, error } = await window.$supabase.from('users').select().eq('id', uid).maybeSingle();

            if (!error && data) {
                return {
                    email: data.email,
                    name: data.username,
                    profile: data.profile,
                    uid: data.id,
                    role: data.role
                }
            } else if (error) {
                // const isConnected = this.isConnection();
                // if (isConnected) {  // DB 연결된 경우
                //     alert('로그인이 필요합니다');
                //     // window.location.href = '/auth/login';
                // }
                throw new StorageBaseError('error in getUserInfo', error, arguments);
            }
        } catch(e) {
            throw new StorageBaseError('error in getUserInfo', e, arguments);
        }
    }

    async resetPassword(email) {
        try {
            let url;
            if (window.location.host.includes('localhost')) {
                url = window.location.host + '/auth/reset-password';
            } else {
                url = '/auth/reset-password';
            }
            const result = await window.$supabase.auth.resetPasswordForEmail(email, {
                redirectTo: url,
            });
            return result;
        } catch (e) {
            throw new StorageBaseError('error in resetPassword', e, arguments);
        }
    }

    async updateUser(new_password) {
        try {
            const result = await window.$supabase.auth.updateUser({
                password: new_password
            });
            return result;
        } catch (e) {
            throw new StorageBaseError('error in updateUser', e, arguments);
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
        } catch(error) {
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
        } catch(error) {
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
                    throw new StorageBaseError('error in putString'+error.message, error, arguments);
                }
            } else if (obj.searchVal) {
                const { error } = await window.$supabase.from(obj.table).upsert(value).eq(obj.searchKey, obj.searchVal);

                if (error) {
                    throw new StorageBaseError('error in putString'+error.message, error, arguments);
                }
            } else {
                const { error } = await window.$supabase.from(obj.table).upsert(value);

                if (error) {
                    throw new StorageBaseError('error in putString'+error.message, error, arguments);
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

            const {error, status, statusText} = result
            if (status!=200 && error) {
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

                if (error && status!=200) {
                    throw new StorageBaseError('error in delete ' + status + " " + statusText, error, arguments);
                }
            } else if (obj.searchVal) {
                const { error, status, statusText  } = await window.$supabase.from(obj.table).delete().eq(obj.searchKey, obj.searchVal);

                if (error && status!=200) {
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
    
        } catch(error) {
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
            }
            if (value.user) {
                window.localStorage.setItem('author', value.user.email);
                window.localStorage.setItem('uid', value.user.id);
                
                if(window.$isTenantServer && userInfo && userInfo.password){
                    await this.putObject('users', {
                        id: value.user.id,
                        username: value.user.user_metadata.name,
                        role: 'superAdmin',
                        is_admin: true,
                        pw: userInfo.password
                    });
                } else {
                    const count = await this.getCount('users');
                    if (count && count === 1) {
                        await this.putObject('users', {
                            id: value.user.id,
                            username: value.user.user_metadata.name,
                            role: 'superAdmin',
                            is_admin: true
                        });
                    } else {
                        await this.putObject('users', {
                            id: value.user.id,
                            username: value.user.user_metadata.name
                        });
                    }
                }

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
        } catch(e) {
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
        if (window.$jms) {
            results = await Promise.all([
                this.searchProcDef(keyword)
            ]);
        } else {
            results = await Promise.all([
                this.searchProcInst(keyword),
                this.searchProcDef(keyword),
                this.searchFormDef(keyword),
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
            const { data, error } = await window.$supabase.from('proc_inst')
                .select()
                .or(`id.ilike.%${keyword}%,name.ilike.%${keyword}%,variables_data.ilike.%${keyword}%`)
                .contains('user_ids', [email]);
            
            if (error) throw new StorageBaseError('error in searchProcInst', error, arguments);

            if (data && data.length > 0) {
                const list = data.map((item) => {
                    const matchingColumns = [];
                    if (item.id && item.id.toLowerCase().includes(keyword.toLowerCase())) {
                        matchingColumns.push(item.id);
                    }
                    if (item.name && item.name.toLowerCase().includes(keyword.toLowerCase())) {
                        matchingColumns.push(item.name);
                    }
                    if (item.variables_data && item.variables_data.toLowerCase().includes(keyword.toLowerCase())) {
                        matchingColumns.push(item.variables_data);
                    }
                    return {
                        title: item.name,
                        href: `/instancelist/${btoa(item.id)}`,
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
            const { data, error } = await window.$supabase.from('proc_def')
                .select()
                .or(`id.ilike.%${keyword}%,name.ilike.%${keyword}%,bpmn.ilike.%${keyword}%`);
            
            if (error) throw new StorageBaseError('error in searchProcDef', error, arguments);
            
            if (data && data.length > 0) {
                const list = data.map((item) => {
                    const matchingColumns = [];
                    if (item.id && item.id.toLowerCase().includes(keyword.toLowerCase())) {
                        matchingColumns.push(item.id);
                    }
                    if (item.name && item.name.toLowerCase().includes(keyword.toLowerCase())) {
                        matchingColumns.push(item.name);
                    }
                    if (item.bpmn && item.bpmn.toLowerCase().includes(keyword.toLowerCase())) {
                        matchingColumns.push(item.bpmn);
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
            const { data, error } = await window.$supabase.from('chat_room_chats')
                .select()
                .or(`messages->>content.ilike.%${keyword}%,messages->>name.ilike.%${keyword}%,messages->>email.ilike.%${keyword}%`);
            
            if (error) throw new StorageBaseError('error in searchChat', error, arguments);
            
            if (data && data.length > 0) {
                let list = data.map((item) => {
                    const email = window.localStorage.getItem('email');
                    if (item.participants && item.participants.some(participant => participant.email === email)) {
                        const matchingColumns = [ `${item.messages.name}: ${item.messages.content}` ];
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
                        header: '채팅 메세지',
                        list: list
                    };
                }
            }
            return null;
        } catch (error) {
            return null;
        }
    }

    
}
