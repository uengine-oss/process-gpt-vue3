// import StorageBase from "./StorageBase";

class StorageBaseError extends Error{
    constructor(message, cause, args) {
        super(message, {cause: cause});

        this.args = args;
    }
}


export default class StorageBaseSupabase {//extends StorageBase{
    
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
                profile: window.localStorage.getItem("picture"),
                uid: result.data.user.id,
                role: result.data.user.role,
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
            if (options && options.match) {
                const { data, error } = await window.$supabase
                    .from(obj.table)
                    .select()
                    .match(options.match);

                if (error) {
                    return error;
                } else {
                    if (data.length > 0) {
                        return data[0];
                    }
                    return null;
                }
            } else if (obj.searchVal) {
                const { data, error } = await window.$supabase
                    .from(obj.table)
                    .select()
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
            console.log(`GET STRING: ${error}`);
            return { Error: error }
        }
    }

    async getObject(path, options) {
        try {
            let obj = this.formatDataPath(path, options);
            if (options && options.match) {
                const { data, error } = await window.$supabase
                    .from(obj.table)
                    .select()
                    .match(options.match);

                if (error) {
                    return error;
                } else {
                    if (data.length > 0) {
                        return data[0];
                    }
                    return null;
                }
            } else if (obj.searchVal) {
                const { data, error } = await window.$supabase
                    .from(obj.table)
                    .select()
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

    // PUT
    async putString(path, value, options) {
        try {
            let obj = this.formatDataPath(path, options);
            if (options && options.match) {
                const { error } = await window.$supabase
                    .from(obj.table)
                    .upsert(value)
                    .match(options.match);
                
                if (!error) {
                    return true;
                } else {
                    return error;
                }
            } else if (obj.searchVal) {
                const { error } = await window.$supabase
                    .from(obj.table)
                    .upsert(value)
                    .eq(obj.searchKey, obj.searchVal);

                if (!error) {
                    return true;
                } else {
                    return error;
                }
            } else {
                const { error } = await window.$supabase
                    .from(obj.table)
                    .upsert(value);
                
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
            if (options && options.match) {
                const { error } = await window.$supabase
                    .from(obj.table)
                    .upsert(value)
                    .match(options.match);
                
                if (error) {
                    throw new StorageBaseError('error in pushObject', error, arguments);
                }
            } else if (obj.searchVal) {
                const { error } = await window.$supabase
                    .from(obj.table)
                    .upsert(value)
                    .eq(obj.searchKey, obj.searchVal);

                if (error) {
                    throw new StorageBaseError('error in pushObject', error, arguments);
                }
            } else {

                // let key = path.split('/').pop();
                // let updateObj = {id: key, value: value}
                
                const { error } = await window.$supabase
                    .from(obj.table)
                    .upsert(value);
                
                if (error) {
                    throw new StorageBaseError('error in pushObject', error, arguments);
                }
            }
        } catch(error) {

            throw new StorageBaseError('error in pushObject', error, arguments);
        }
    }

    // PUSH
    async pushString(path, value, options) {
        try {
            let obj = this.formatDataPath(path, options);
            if (options && options.match) {
                const { error } = await window.$supabase
                    .from(obj.table)
                    .upsert(value)
                    .match(options.match);
                
                if (!error) {
                    return true;
                } else {
                    return error;
                }
            } else if (obj.searchVal) {
                const { error } = await window.$supabase
                    .from(obj.table)
                    .upsert(value)
                    .eq(obj.searchKey, obj.searchVal);

                if (!error) {
                    return true;
                } else {
                    return error;
                }
            } else {
                const { error } = await window.$supabase
                    .from(obj.table)
                    .upsert(value);
                
                if (!error) {
                    return true;
                } else {
                    return error;
                }
            }
        } catch(error) {
            throw new Error('error in pushObject', {cause: error, args: arguments});
        }
    }

    async pushObject(path, value, options) {
        try {
            let obj = this.formatDataPath(path, options);
            if (options && options.match) {
                const { error } = await window.$supabase
                    .from(obj.table)
                    .upsert(value)
                    .match(options.match);
                
                if (error) {
                    throw new StorageBaseError('error in pushObject', error, arguments);
                }
            } else if (obj.searchVal) {
                const { error } = await window.$supabase
                    .from(obj.table)
                    .upsert(value)
                    .eq(obj.searchKey, obj.searchVal);

                if (error) {
                    throw new StorageBaseError('error in pushObject', error, arguments);
                }
            } else {
                const { error } = await window.$supabase
                    .from(obj.table)
                    .upsert(value);
                
                if (error) {
                    throw new StorageBaseError('error in pushObject', error, arguments);
                }
            }
        } catch(error) {
            throw new StorageBaseError('error in pushObject', error, arguments);
        }
    }

    // DELETE
    async delete(path, options) {
        try {
            let obj = this.formatDataPath(path, options);
            if (options && options.match) {
                const { data, error } = await window.$supabase
                    .from(obj.table)
                    .delete()
                    .match(options.match);

                if (!error) {
                    return true;
                } else {
                    return error;
                }
            } else if (obj.searchVal) {
                const { error } = await window.$supabase
                    .from(obj.table)
                    .delete()
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

    async watch(path, callback) {
        try {
            let obj = this.formatDataPath(path);
            await window.$supabase
                .channel('room1')
                .on('postgres_changes', {
                    event: '*', 
                    schema: 'public', 
                    table: obj.table
                }, payload => {
                    console.log('Change received!', payload)
                    callback(payload)
                })
                .subscribe();
            
        } catch(error) {
            console.log(`WATCH: ${error}`);
            return { Error: error }
        }
    }

    async watch_added(path, callback) {
        try {
            let obj = this.formatDataPath(path);
            await window.$supabase
                .channel('room1')
                .on('postgres_changes', {
                    event: '*', 
                    schema: 'public', 
                    table: obj.table
                }, payload => {
                    console.log('Change received!', payload)
                    callback(payload)
                })
                .subscribe();
            
        } catch(error) {
            console.log(`WATCH ADDED: ${error}`);
            return { Error: error }
        }
    }

    async list(path, options) {
        try {
            let obj = this.formatDataPath(path, options);
            if (options && options.match) {
                const { data, error } = await window.$supabase
                    .from(obj.table)
                    .select()
                    .match(options.match);

                if (error) {
                    return error;
                } else {
                    if (data.length > 0) return data;
                    return null;
                }
            } else if (obj.searchVal) {
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

    async writeUserData(value) {
        if (value.session) {
            window.localStorage.setItem("accessToken", value.session.access_token);
        }
        if (value.user) {
            window.localStorage.setItem("author", value.user.email);
            window.localStorage.setItem("userName", value.user.user_metadata.name);
            window.localStorage.setItem("email", value.user.email);
            // window.localStorage.setItem("picture", value.user.profile);
            window.localStorage.setItem("uid", value.user.id);
        }
        var userInfo = await this.getObject(`users/${value.user.id}`, {key: 'id'});
        if (userInfo) {
            window.localStorage.setItem("picture", userInfo.profile);
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

    async getCount(path, options) {
        try {
            let obj = this.formatDataPath(path, options);
            if (options && options.match) {
                const { count, error } = await window.$supabase
                    .from(obj.table)
                    .select('*', { count: 'exact' })
                    .match(options.match);

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
                const { count, error } = await window.$supabase
                    .from(obj.table)
                    .select('*', { count: 'exact' });

                if (error) {
                    return error;
                } else {
                    return count;
                }
            }
        } catch(error) {
            console.log(`GET COUNT: ${error}`);
            return { Error: error }
        }
    }
}
