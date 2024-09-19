export default class AIGenerator {
    constructor(client, options) {
        this.client = client;
        this.finish_reason = null;
        this.modelJson = null;
        this.stopSignaled = false;
        this.gptResponseId = null;
        this.openaiToken = null;
        // this.model = "gpt-3.5-turbo-16k"
        this.model = 'gpt-4o';
        //this.model = "gpt-4-vision-preview"

        if (this.model.includes('vision')) {
            this.vision = true;
        }

        if (options) {
            this.preferredLanguage = options.preferredLanguage;
            this.previousMessages = options.previousMessages;
            this.prompt = options.prompt;
            this.model = options.model || this.model;
            this.options = options;
        } else {
            this.options = {};
        }

        if (!this.previousMessages) {
            this.previousMessages = [];
        }

        if (!this.prompt) {
            this.prompt = '';
        }

        if (!this.preferredLanguage) {
            this.preferredLanguage = 'English';

            if (window && window.countryCode == 'ko') {
                this.preferredLanguage = 'Korean';
            }
        }

        this.cacheReplayDelay = this.options.cacheReplayDelay ? this.options.cacheReplayDelay : 3000;
    }

    createPrompt() {
        return this.prompt ? this.prompt : 'say hello in Korean.';
    }

    stop() {
        this.stopSignaled = true;
        if (this.client.onModelStopped) {
            this.client.onModelStopped();
        }
    }

    generateHashKey(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = (hash << 5) - hash + char;
            hash = hash & hash; // Convert to 32bit integer
        }
        return hash;
    }

    returnCache(messages) {
        let me = this;

        if (localStorage.getItem('useCache') == 'true') {
            let message = JSON.stringify(messages);

            let hashKey = this.generateHashKey(message);
            let existingResult = localStorage.getItem('cache-' + hashKey);

            if (existingResult) {
                let localStorageKey = 'cache-' + hashKey + '-steps';
                let steps = localStorage.getItem('cache-' + hashKey + '-steps');

                if (steps) {
                    steps = JSON.parse(steps);

                    let i = 0;

                    let loop = setInterval(() => {
                        let model = me.createModel(existingResult.substring(0, steps[i++]));

                        if (me.client.onModelCreated && me.client.genType != 'form') {
                            me.client.onModelCreated(model);
                        }

                        if (steps.length - 1 == i) {
                            //last

                            me.state = 'end';

                            if (me.client.onGenerationFinished) me.client.onGenerationFinished(model);

                            clearInterval(loop);
                        }
                    }, me.cacheReplayDelay);
                } else
                    setTimeout(() => {
                        me.state = 'end';

                        let model = me.createModel(existingResult);

                        if (me.client.onModelCreated && me.client.genType != 'form') {
                            me.client.onModelCreated(model);
                        }

                        if (me.client.onGenerationFinished) me.client.onGenerationFinished(model);
                    }, 0);

                return true;
            }
        }
    }

    saveCacheSteps(messages, step) {
        let me = this;
        let hashKey = me.generateHashKey(JSON.stringify(messages));

        //save the result lengths of step-by-step
        if (localStorage.getItem('useCache') == 'true') {
            let localStorageKey = 'cache-' + hashKey + '-steps';
            let steps = localStorage.getItem('cache-' + hashKey + '-steps');
            if (steps) {
                steps = JSON.parse(steps);
            } else steps = [];

            steps.push(step);

            localStorage.setItem(localStorageKey, JSON.stringify(steps));
        }
    }

    saveCache(messages) {
        let me = this;

        let hashKey = me.generateHashKey(JSON.stringify(messages));

        if (localStorage.getItem('useCache') == 'true') {
            localStorage.setItem('cache-' + hashKey, me.modelJson);
        }
    }

    async generate() {
        this.state = 'running';
        let me = this;
        let messages = this.createMessages();

        if (this.returnCache(messages)) return;

        me.openaiToken = me.client.openaiToken;
        let responseCnt = 0;

        me.gptResponseId = null;
        const url = 'https://api.openai.com/v1/chat/completions';
        const xhr = new XMLHttpRequest();
        xhr.open('POST', url);
        xhr.setRequestHeader('Content-Type', 'application/json');
        xhr.setRequestHeader('Authorization', 'Bearer ' + me.openaiToken);

        xhr.onprogress = function (event) {
            var currentResId;
            if (me.stopSignaled) {
                xhr.abort();
                me.stopSignaled = false;
                me.state = 'stopped';
            }
            // console.log("Received " + event.loaded + " bytes of data.");
            // console.log("Data: " + xhr.responseText);
            const newUpdates = xhr.responseText.replace('data: [DONE]', '').trim().split('data: ').filter(Boolean);

            const newUpdatesParsed = newUpdates.map((update) => {
                const parsed = JSON.parse(update);

                if (parsed.error) {
                    if (me.client.onError) {
                        me.client.onError(parsed.error);
                    }
                    throw new Error(parsed.error.message);
                }

                currentResId = parsed.id;
                if (!me.gptResponseId) {
                    me.gptResponseId = parsed.id;
                }
                if (parsed.choices[0].finish_reason == 'length') {
                    me.finish_reason = 'length';
                }
                return parsed.choices[0].delta.content || '';
            });

            const newUpdatesJoined = newUpdatesParsed.join('');
            if (newUpdatesJoined.includes(': null')) {
                newUpdatesJoined.replaceAll(': null', ": 'null'");
            }
            me.modelJson = newUpdatesJoined;

            if (me.client.onReceived) {
                if (me.gptResponseId == currentResId) {
                    me.client.onReceived(newUpdatesJoined);
                }
            }

            if (me.client.onModelCreated && me.client.genType != 'form') {
                if (responseCnt > 15) {
                    me.saveCacheSteps(messages, newUpdatesJoined.length);

                    me.client.onModelCreated(me.createModel(newUpdatesJoined));
                    responseCnt = 0;
                } else {
                    responseCnt++;
                }
            }
        };

        xhr.onloadend = function () {
            console.log('End to Success - onloadend', xhr);
            if (me.client) {
                if (me.finish_reason == 'length') {
                    // me.continue();
                    console.log('max_token issue');
                }

                me.state = 'end';
                let model = me.createModel(me.modelJson);

                if (!me.stopSignaled) {
                    if(me.client.genType && me.client.genType == 'form'){
                        if (me.client.onFormCreated) {
                            me.client.onFormCreated(model);
                        }
                        if (me.client.onFormGenerationFinished) {
                            me.client.onFormGenerationFinished(model);
                        }
                    } else {
                        if (me.client.onModelCreated && me.client.genType != 'form') {
                            me.client.onModelCreated(model);
                        }
                        if (me.client.onGenerationFinished) {
                            me.client.onGenerationFinished(model);
                        }
                    }
                }

                me.saveCache(messages);
            }

            me.previousMessages.push({
                role: 'system',
                content: me.modelJson
            });
        };

        if (this.isContinued) messages[messages.length - 1].content = 'continue';

        const data = {
            model: this.model,
            messages: messages,
            temperature: 1,
            frequency_penalty: 0,
            presence_penalty: 0,
            stream: this.options.isStream
        };

        if (this.model.includes('vision')) data.max_tokens = 4096;

        if (me.stopSignaled) {
            me.stopSignaled = false;
        }
        xhr.send(JSON.stringify(data));
    }

    createMessages() {
        var me = this;
        if (me.previousMessages && me.previousMessages.length > 0) {
            // me.previousMessages.push({
            //     role: 'user',
            //     content: me.createPrompt() + (me.preferredLanguage ? '\n please generate in ' + me.preferredLanguage : '')
            // });
        } else {
            let prompt = me.createPrompt();
            if (prompt) {
                // Issue - 결과 값이 이상한 방식으로 출력됨.
                me.previousMessages.push({
                    role: 'user',
                    content: prompt + (me.preferredLanguage ? '\n please generate in ' + me.preferredLanguage : '')
                });
            }
        }

        return me.previousMessages;
    }

    continue() {
        this.isContinued = true;
        this.generate();
    }

    createModel(text) {
        return text;
    }
}
