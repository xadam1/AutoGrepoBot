var GrepoBot =
{
    config:
    {
        activated: false,
        claimed: 0,
        timerID: 0,
        debug: true,
        domain: "",
        repoDomain: "https://github.com/xadam1/autogrepobot/",
        interval: 0,
        lang: Game.market_id,
        timeout: 3000,
        timeoutBetweenTowns = 0,
        version: "1.1"
    },

    message:
    {
        en:
        {
            LOADED_SUCCESSFULLY: "GrepoBot v.1.1 loaded!",

            CAPTCHA: "A CAPTCHA has just been discovered, stop the bot.",
            CAPTAIN_IS_NOT_ACTIVE: "Captain is currently not activated!",
        }
    },
    towns: {},
    premium: {},

    announce: function (message) {
        if ($(".notice").length == 0) {
            $("#ui_box").append('<div class="notice"></div>');
            $("#ui_box").append($("<audio>",
                {
                    preload: "auto",
                    id: "mp3",
                    src: this.config.repoDomain + "sound/alert.mp3"
                }));
        }
        $(".notice").append($("<p>",
            {
                text: "GrepoBot: " + message
            }).on("click", function () {
                this.remove();
            }).delay(5000).fadeOut(1000));

        if (this.config["debug"]) {
            console.log(new Date().toTimeString() + " " + message);
        }
    },

    claim: function () {
        var self = this;
        this.config.timeoutBetweenTowns = getRandom(3000, 5000);

        jQuery.each(this.towns, function (key, town) {
            if (town.villages.length > 0) {
                // Checks if tow in full
                var resources = ITowns.getResources(town.id)
                var storage = resources.storage;

                var ironMissing = storage - resources.iron;
                var woodMissing = storage - resources.wood;
                var stoneMissing = storage - resources.stone;

                if (ironMissing == 0 && woodMissing == 0 && stoneMissing == 0) {
                    return true;
                }

                setTimeout(function () {
                    // Gets resources from city
                    /* Looks like this
                     * favor: 0
                     * iron: 10250
                     * population: 600
                     * stone: 9397
                     * storage: 13550
                     * wood: 9158                    
                    */
                    var resources = ITowns.getResources(town.id)
                    var storage = resources.storage;

                    var iron = storage - resources.iron;
                    var wood = storage - resources.wood;
                    var stone = storage - resources.stone;

                    // sets min to 5% of the storage
                    var min = Math.floor(0.05 * storage);

                    // aka cave
                    var hide = ITowns.getTown(town.id).getBuildings().attributes.hide;

                    if (iron < min) {
                        // hide * 1000 - ITowns.getTown(town.id).getEspionageStorage()
                        // ==> amount that can be stored, if cave/hide is not lv 10
                        if (hide == 10 || hide * 1000 - ITowns.getTown(town.id).getEspionageStorage() < 2 * min) {
                            self.storeIronIntoTheCave(town.id, 2 * min);
                        }
                    }

                    // CAPTAIN ACTIVE
                    if (self.isPremiumActive("captain")) {
                        var json =
                        {
                            farm_town_ids: [],
                            time_option: 300,
                            claim_factor: "normal",
                            current_town_id: town.id,
                            town_id: Game.townId
                        };

                        jQuery.each(town.villages, function (k, village) {
                            json.farm_town_ids.push(village.id);
                        });

                        self.request("farm_town_overviews", "claim_loads", json, "post", function (wnd, response) { });
                    }

                    // CAPTAIN IS NOT ACTIVE
                    else {
                        var timeoutBetweenVillages = 0;
                        jQuery.each(town.villages, function (k, village) {
                            setTimeout(function () {
                                var json =
                                {
                                    target_id: village.id,
                                    claim_type: "normal",
                                    time: 300,
                                    town_id: town.id
                                };
                                self.request("farm_town_info", "claim_load", json, "post", function (wnd, response) {
                                    if (response.error == "You dont own this farm town.") {
                                        var index = self.towns[town.id].villages.map(function (obj) {
                                            return obj.id;
                                        }).indexOf(village.id);
                                        if (index != -1) {
                                            self.towns[town.id].villages.splice(index, 1);
                                        }
                                    }
                                    else
                                        if (village.level == -1) {
                                            village.level = response.expansion_stage;
                                        }
                                });
                            }, timeoutBetweenVillages += getRandom(500, 750));
                        });
                    }
                }, timeoutBetweenTowns);
            }
        });
    },


    isPremiumActive: function (service) {
        switch (service) {
            case "curator":
                return (this.premium.curator > Timestamp.now());

            case "captain":
                return (this.premium.captain > Timestamp.now());

            case "commander":
                return (this.premium.commander > Timestamp.now());

            case "priest":
                return (this.premium.priest > Timestamp.now());

            case "trader":
                return (this.premium.trader > Timestamp.now());
        }
    },


    load: function () {
        this.loader = new GPAjax(Layout, false);

        if (typeof jQuery == "undefined") {
            var script = document.createElement("script");

            script.src = "https://ajax.googleapis.com/ajax/libs/jquery/2.1.1/jquery.min.js";
            script.type = "text/javascript";

            document.getElementsByTagName("head")[0].appendChild(script);
        }

        $("head").append($("<link>",
            {
                rel: "stylesheet",
                type: "text/css",
                //href: this.config.domain + "GrepoBot.css"
                href: "https://cdn.jsdelivr.net/gh/xadam1/AutoGrepoBot@305dbcf/GrepoBot.css"
            }));

        this.premium = Game.premium_features;
        this.loadTowns();

        // Clear / create QuickBar
        if (this.isPremiumActive("curator")) {
            $(".ui_quickbar .left, .ui_quickbar .right").empty();
        }
        else {
            $(".ui_quickbar").append($("<div>",
                {
                    class: "left"
                }), $("<div>",
                    {
                        class: "right"
                    }));
        }

        this.loadMenuPanel();
        this.announce(this.message.en.LOADED_SUCCESSFULLY);
    },

    loadMenuPanel: function () {
        var off = "AutoFarm: [ <font color=\"red\"> OFF </font> ]";
        var on = "AutoFarm: [ <font color=\"green\"> ON </font> ]";

        var self = this;
        $(".ui_quickbar .left").append($("<div>",
            {
                class: "autogrepo",
                click: function () {
                    if (self.config.activated) {
                        $(this).empty().append(off);
                    }
                    else {
                        $(this).empty().append(on);
                    }
                    self.switchState();
                }
            }).html(((self.config.activated) ? on : off)));

        $(".ui_quickbar .left").append($("<div>",
            {
                class: "autogrepo",
                click: function () {
                    Layout.buildingWindow.open("main");
                }
            }).html("Senat"));

        $(".ui_quickbar .left").append($("<div>",
            {
                class: "autogrepo",
                click: function () {
                    // TODO PREMIUM CHECK
                    Layout.wnd.Create(Layout.wnd.TYPE_FARM_TOWN_OVERVIEWS, "FarmTowns");
                }
            }).html("FarmTowns"));

        $(".ui_quickbar .left").append($("<div>",
            {
                class: "autogrepo",
                click: function () {
                    Layout.buildingWindow.open("academy");
                }
            }).html("Akademie"));

        $(".ui_quickbar .right").append($("<div>",
            {
                id: "timer",
                class: "autogrepo-timer"
            }).html("TimerToNextFarm: MM:SS"));

        $(".ui_quickbar .right").append($("<div>",
            {
                id: "footer",
                class: "autogrepo"
            }).html("Powered by GrepoBot (v. " + this.config.version + ")"));
    },

    loadTowns: function () {
        var self = this;
        jQuery.each(ITowns.getTowns(), function (k, object) {
            var town =
            {
                id: object.id,

                x: object.getIslandCoordinateX(),
                y: object.getIslandCoordinateY(),

                villages: []
            };

            self.towns[object.id] = town;
            self.loadFarmTowns(object.id);
        });
    },

    loadFarmTowns: function (townId) {
        var self = this;
        if (this.isPremiumActive("captain")) {
            var town = ITowns.getTown(townId);
            var json =
            {
                island_x: self.towns[townId].x,
                island_y: self.towns[townId].y,

                current_town_id: townId,

                booty_researched: town.researches().attributes.booty,
                trade_office: town.getBuildings().trade_office,

                town_id: Game.townId
            };

            this.request("farm_town_overviews", "get_farm_towns_for_town", json, "get", function (wnd, data) {
                jQuery.each(data.farm_town_list, function (k, object) {
                    if (object.rel > 0) {
                        self.towns[townId].villages.push(
                            {
                                id: object.id,
                                level: object.stage
                            });
                    }
                });

                self.towns[townId].villages.sort(function (a, b) {
                    return a.level - b.level;
                });
            });
        }
        else {
            self.request("index", "switch_town",
                {
                    town_id: townId
                }, "get", function (wnd, response) {
                    jQuery.each(response.farm_towns, function (k, village) {
                        self.towns[townId].villages.push(
                            {
                                id: village.id,
                                level: -1
                            });
                    })
                }, null);

            this.announce(this.message.en.CAPTAIN_IS_NOT_ACTIVE);
        }
    },

    request: function (controller, action, parameters, method, callback, module) {
        if (Game.bot_check != null) {
            $("#mp3").trigger("play");
            this.config.activated = false;
            this.announce(this.message.en.CAPTCHA);

            return;
        }

        var self = this;
        var object =
        {
            success: function (context, data, flag, t_token) {
                if (callback) {
                    data.t_token = t_token;
                    if (data.bar && data.bar.resources) {
                        ITowns.setResources(data.bar.resources, data.t_token);
                    }
                    if (data.success) {
                        self.announce(data.success);
                    }
                    callback(self, data, flag);
                }
            },
            error: function (context, data, t_token) {
                if (data.error) {
                    self.announce(data.error);
                }
                console.log(self, data);
                callback(self, data);
            }
        };

        if (!parameters) {
            this.announce("Empty request has just been blocked");
            return;
        }

        parameters.nlreq_id = Game.notification_last_requested_id;
        this.loader[method](controller, action, parameters, false, object, module);
    },

    storeIronIntoTheCave: function (town_id, amount) {
        var json =
        {
            town_id: town_id
        };

        if (this.isPremiumActive("curator")) {
            json.active_town_id = Game.townId;
            json.iron_to_store = amount;

            this.request("town_overviews", "store_iron", json, "post", function (wnd, response) { }, null);
        }
        else {
            json.model_url = "BuildingHide";
            json.action_name = "storeIron";
            json.arguments =
            {
                iron_to_store: amount
            };

            this.request("frontend_bridge", "execute", json, "post", function (wnd, response) { }, null);
        }
    },

    switchState: function () {
        if (!this.config["activated"]) {
            // BOT IS BEING SWITCHED ON
            if ((Date.now() - this.config["claimed"]) > 600000) {
                // Claimed more than 10 mins ago
                this.handleClaim();
            }
            else {
                // Wait till villages are ready (10 mins)
                setTimeout(this.handleClaim, Date.now() - this.config.claimed);
            }
        }
        else {
            // BOT IS BEING SWITCHED OFF
            clearInterval(this.config["interval"]);
            $(".ui_quickbar .right .autogrepo-timer")[0].innerHTML = "Timer: PAUSED";
        }
        this.config["activated"] = !this.config["activated"];
    },

    handleClaim: function () {
        this.config.interval = setInterval(function () {
            this.claim();
            this.config.claimed = Date.now();

            var waitingTime = getRandom(610000, 660000);
            this.config["interval"] = setInterval(function () {
                this.GrepoBot.claim();
                timer(waitingTime);
            }, waitingTime);

        })
    }
};

function getRandom(a, b) {
    return Math.floor(Math.random() * (b - a + 1)) + a;
}

function resetTimer() {
    clearInterval(GrepoBot.config.timerID);
    $(".ui_quickbar .right .autogrepo-timer")[0].innerHTML = "Bot is farming...";
}

async function timer(waitingTime) {
    // get time in seconds
    var time = floor(waitingTime / 1000)

    GrepoBot.config.timerID = setInterval(function () {
        minutes = parseInt(time / 60, 10);
        seconds = parseInt(time % 60, 10);

        minutes = minutes < 10 ? "0" + minutes : minutes;
        seconds = seconds < 10 ? "0" + seconds : seconds;

        $(".ui_quickbar .right .autogrepo-timer")[0].innerHTML = "Time Until Next Farming: " + minutes + ":" + seconds;

        if (--time < 0) {
            // stop the timer and reset UI
            resetTimer();
        }
    }, 1000);
}


// INIT
setTimeout(function () {
    GrepoBot.load();
}, GrepoBot.config.timeout);