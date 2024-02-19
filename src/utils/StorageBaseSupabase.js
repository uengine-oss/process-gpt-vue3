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

    async getUserInfo() {
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

    async getString(path, options) {
        try {
            let obj = this.formatDataPath(path, options);
            if (obj.searchVal) {
                const { data, error } = await window.$supabase.from(obj.table).select()
                    .eq(obj.searchKey, obj.searchVal);
                if (error) {
                    return error;
                } else {
                    if (data.length > 0) {
                        return data[0];
                    }
                    return null;
                }
            } else {
                const { data, error } = await window.$supabase.from(obj.table).select();
                if (error) {
                    return error;
                } else {
                    if (data.length > 0) return data;
                    return null;
                }
            }
        } catch(error) {
            console.log(`GET STRING: ${error}`);
            return { Error: error }
        }
    }

    async getObject(path, options) {
        try {
            let obj = this.formatDataPath(path, options);
            if (obj.searchVal) {
                const { data, error } = await window.$supabase.from(obj.table).select()
                    .eq(obj.searchKey, obj.searchVal);
                if (error) {
                    return error;
                } else {
                    if (data.length > 0) {
                        return data[0];
                    }
                    return null;
                }
            } else {
                const { data, error } = await window.$supabase.from(obj.table).select();
                if (error) {
                    return error;
                } else {
                    if (data.length > 0) return data;
                    return null;
                }
            }
        } catch(error) {
            console.log(`GET OBJECT: ${error}`);
            return { Error: error }
        }
    }

    // PUT
    async putString(path, value, options) {
        try {
            let obj = this.formatDataPath(path, options);
            if (obj.searchVal) {
                const { error } = await window.$supabase.from(obj.table).upsert(value)
                    .eq(obj.searchKey, obj.searchVal);
                if (!error) {
                    return true;
                } else {
                    return error;
                }
            } else {
                const { error } = await window.$supabase.from(obj.table).upsert(value);
                if (!error) {
                    return true;
                } else {
                    return error;
                }
            }
        } catch(error) {
            console.log(`PUT STRING: ${error}`);
            return { Error: error }
        }
    }

    async putObject(path, value, options) {
        try {
            let obj = this.formatDataPath(path, options);
            value = this.formatDataValue(value);
            if (obj.searchVal) {
                const { error } = await window.$supabase.from(obj.table).upsert(value)
                    .eq(obj.searchKey, obj.searchVal);
                if (!error) {
                    return true;
                } else {
                    return error;
                }
            } else {
                const { error } = await window.$supabase.from(obj.table).upsert(value);
                if (!error) {
                    return true;
                } else {
                    return error;
                }
            }
        } catch(error) {
            console.log(`PUT OBJECT: ${error}`);
            return { Error: error }
        }
    }

    // PUSH
    async pushString(path, value, options) {
        try {
            let obj = this.formatDataPath(path, options);
            if (obj.searchVal) {
                const { error } = await window.$supabase.from(obj.table).upsert(value)
                    .eq(obj.searchKey, obj.searchVal);
                if (!error) {
                    return true;
                } else {
                    return error;
                }
            } else {
                const { error } = await window.$supabase.from(obj.table).upsert(value);
                if (!error) {
                    return true;
                } else {
                    return error;
                }
            }
        } catch(error) {
            console.log(`PUSH STRING: ${error}`);
            return { Error: error }
        }
    }

    async pushObject(path, value, options) {
        try {
            let obj = this.formatDataPath(path, options);
            if (obj.searchVal) {
                const { error } = await window.$supabase.from(obj.table).upsert(value)
                    .eq(obj.searchKey, obj.searchVal);
                if (!error) {
                    return true;
                } else {
                    return error;
                }
            } else {
                const { error } = await window.$supabase.from(obj.table).upsert(value);
                if (!error) {
                    return true;
                } else {
                    return error;
                }
            }
        } catch(error) {
            console.log(`PUSH OBJECT: ${error}`);
            return { Error: error }
        }
    }

    // DELETE
    async delete(path, options) {
        try {
            let obj = this.formatDataPath(path, options);
            if (obj.searchVal) {
                const { error } = await window.$supabase.from(obj.table).delete()
                    .eq(obj.searchKey, obj.searchVal);
                if (!error) {
                    return true;
                } else {
                    return error;
                }
            }

            return false;
        } catch(error) {
            console.log(`DELETE: ${error}`);
            return { Error: error }
        }
    }

    async watch(path, options) {
        try {
            let obj = this.formatDataPath(path, options);
            await window.$supabase
                .channel(obj.table)
                .on('*', payload =>
                    console.log('received!', payload)
                )
                .subscribe();
            
        } catch(error) {
            console.log(`WATCH: ${error}`);
            return { Error: error }
        }
    }

    async watch_added(path, options) {
        try {
            let obj = this.formatDataPath(path, options);
            return await window.$supabase.from(obj.table).select();
        } catch(error) {
            return { Error: error }
        }
    }

    async list(path, options) {
        try {
            let obj = this.formatDataPath(path, options);
            if (obj.searchVal) {
                const { data, error } = await window.$supabase
                    .from(obj.table)
                    .select()
                    .eq(obj.searchKey, obj.searchVal);
                
                if (error) {
                    return error;
                } else {
                    if (data.length > 0) return data;
                    return null;
                }
            } else {
                const { data, error } = await window.$supabase
                    .from(obj.table)
                    .select();
                
                if (error) {
                    return error;
                } else {
                    if (data.length > 0) return data;
                    return null;
                }
            }
        } catch(error) {
            console.log(`GET OBJECT: ${error}`);
            return { Error: error }
        }
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

    formatDataPath(path, options) {
        path = path.includes('://') ? path.split('://')[1] : path;
        let obj = {
            table: "",
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
    }

    formatDataValue(value) {
        let obj = {};
        let keyArr = Object.keys(value);
        keyArr.forEach(key => {
            var newKey = key.toLocaleLowerCase();
            obj[newKey] = value[key];
        });
        obj = [obj];
        return obj;
    }
}
