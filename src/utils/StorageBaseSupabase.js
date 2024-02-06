// import StorageBase from "./StorageBase";

export default class StorageBaseSupabase {
    
    async signIn(userInfo) {
        const result = await window.$supabase.auth.signInWithPassword({
            email: userInfo.email, 
            password: userInfo.password
        });
        if (!result.error) {
            this.writeUserData(result.data);
            return result.data;
        } else {
            return result.error
        }
    }

    async signUp(userInfo) {
        const result = await window.$supabase.auth.signUp({
            email: userInfo.email, 
            password: userInfo.password,
            options: {
                data: {
                    name: userInfo.username,
                }
            }
        });
        if (!result.error) {
            this.writeUserData(result.data);
            return result.data;
        } else {
            return result.error
        }
    }

    async signOut() {
        window.localStorage.removeItem("accessToken");
        window.localStorage.removeItem("author");
        window.localStorage.removeItem("userName");
        window.localStorage.removeItem("email");
        window.localStorage.removeItem("picture");
        window.localStorage.removeItem("uid");
        return await window.$supabase.auth.signOut();
    }

    async getUser(path, value) {
        const result = await window.$supabase.auth.getUser();
        if (result && result.data && result.data.user) {
            const userInfo = {
                email: result.data.user.email,
                name: result.data.user.user_metadata.name,
                profile: result.data.user.user_metadata.profile,
                uid: result.data.user.id,
                role: result.data.user.role,
                phone: result.data.user.phone,
                last_sign_in_at: result.data.user.last_sign_in_at
            }
            return userInfo;
        } else {
            return null;
        }
    }

    async getString(path) {
        try {
            var obj = this.setDataPath(path);
            var result = null;
            if (obj.searchVal) {
                result = await window.$supabase.from(obj.table).select().eq(obj.searchKey, obj.searchVal);
            } else {
                result = await window.$supabase.from(obj.table).select();
            }

            if (result.count && result.data) {
                return result.data;
            } else {
                return null;
            }
        } catch(error) {
            return { Error: error }
        }
    }

    async getObject(path) {
        try {
            var obj = this.setDataPath(path);
            var result = null;
            if (obj.searchVal) {
                return await window.$supabase.from(obj.table).select().eq(obj.searchKey, obj.searchVal);
            } else {
                result = await window.$supabase.from(obj.table).select();
            }

            if (result.count && result.data) {
                return result.data;
            } else {
                return null;
            }
        } catch(error) {
            return { Error: error }
        }
    }

    async putString(path, value, options) {
        try {
            var obj = this.setDataPath(path);
            if (obj.searchVal) {
                return await window.$supabase.from(obj.table).upsert(value).eq(obj.searchKey, obj.searchVal);
            } else {
                return await window.$supabase.from(obj.table).upsert(value);
            }
        } catch(error) {
            return { Error: error }
        }
    }

    async putObject(path, value, options) {
        try {
            var obj = this.setDataPath(path);
            if (obj.searchVal) {
                return await window.$supabase.from(obj.table).upsert(value).eq(obj.searchKey, obj.searchVal);
            } else {
                return await window.$supabase.from(obj.table).upsert(value);
            }
        } catch(error) {
            return { Error: error }
        }
    }

    async pushString(path, value, options) {
        try {
            var obj = this.setDataPath(path);
            if (obj.searchVal) {
                return await window.$supabase.from(obj.table).upsert(value).eq(obj.searchKey, obj.searchVal);
            } else {
                return await window.$supabase.from(obj.table).upsert(value);
            }
        } catch(error) {
            return { Error: error }
        }
    }

    async pushObject(path, value, options) {
        try {
            var obj = this.setDataPath(path);
            if (obj.searchVal) {
                return await window.$supabase.from(obj.table).upsert(value).eq(obj.searchKey, obj.searchVal);
            } else {
                return await window.$supabase.from(obj.table).upsert(value);
            }
        } catch(error) {
            return { Error: error }
        }
    }

    async delete(path) {
        try {
            var obj = this.setDataPath(path);
            if (obj.searchVal) {
                return await window.$supabase.from(obj.table).delete().eq(obj.searchKey, obj.searchVal);
            }
        } catch(error) {
            return { Error: error }
        }
    }

    async watch(path) {
        try {
            var obj = this.setDataPath(path);
            return await window.$supabase.from(obj.table).select();
        } catch(error) {
            return { Error: error }
        }
    }

    async watch_added(path) {
        try {
            var obj = this.setDataPath(path);
            return await window.$supabase.from(obj.table).select();
        } catch(error) {
            return { Error: error }
        }
    }

    async list(path) {
        try {
            var obj = this.setDataPath(path);
            return await window.$supabase.from(obj.table).select();
        } catch(error) {
            return { Error: error }
        }
    }

    setDataPath(path) {
        path = path.includes('://') ? path.split('://')[1] : path;
        var obj = {
            table: "",
        };

        if (path.includes('/')) {
            obj.table = path.split('/')[0];
            // obj.searchKey = "";
            // obj.searchVal = path.split('/')[1];
        } else {
            obj.table = path;
        }
        
        return obj;
    }

    writeUserData(value) {
        if (value.session) {
            window.localStorage.setItem("accessToken", value.session.access_token);
        }
        if (value.user) {
            window.localStorage.setItem("author", value.user.email);
            window.localStorage.setItem("userName", value.user.user_metadata.name);
            window.localStorage.setItem("email", value.user.email);
            window.localStorage.setItem("picture", value.user.profile);
            window.localStorage.setItem("uid", value.user.id);
        }
    }
}
