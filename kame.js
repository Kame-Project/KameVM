(function (root, name, factory) {
    if (typeof exports === "object" && exports) {
        module.exports = factory(); // CommonJS
    } else if (typeof define === "function" && define.amd) {
        define(factory); // AMD (RequireJS and family)
    } else {
        root[name] = factory(); // Browser <script>
    }
})(this, "Kame", function () {
    var exports = {};

    exports.name = "Kame";
    exports.version = "0.0.0";

    var KisNull = function (val) {
        return (val === null) || (val === undefined);
    };

    var Kid = function (val) { return val; }

    var Ksend = function (obj, message, args, cb) {
        // console.log(KtoNative(KlistToCons([obj, message, args, cb], Kid)));
        if (KisNull(obj)) { cb(); return; }
        var done = false;
        var cbOnce = function (val) {
            if (!done) {
                cb(val);
            } else {
                console.warn("callback called more than once: " + message);
            }
            done = true;
        };
        obj.send(message, args, cbOnce);
    };

    var KrespondsTo = function (args, cb, messages) {
        Ksend(args, "car", Kcons(), function (val) {
            if (!val.nativeString) { cb(Kfalse); return; }
            var message = val.nativeString();
            for (var i = 0, l = messages.length; i < l; i++) {
                if (messages[i] === message) {
                    cb(Ktrue); return;
                }
            }
            cb(Kfalse); return;
        });
    };

    var Kcons = function (theCar, theCdr) {
        var car = theCar, cdr = theCdr;
        var obj = {
            car: function () { return car; },
            cdr: function () { return cdr; },
            setCar: function (theCar) { car = theCar; },
            setCdr: function (theCdr) { cdr = theCdr; },
            send: function (message, args, cb) {
                if (message === "car") {
                    cb(obj.car());
                    return;
                }
                if (message === "cdr") {
                    cb(obj.cdr());
                    return;
                }
                if (message === "setCar") {
                    Ksend(args, "car", Kcons(), function (val) {
                        obj.setCar(val);
                        cb();
                    });
                    return;
                }
                if (message === "setCdr") {
                    Ksend(args, "car", Kcons(), function (val) {
                        obj.setCdr(val);
                        cb();
                    });
                    return;
                }
                if (message === "respondsTo") {
                    KrespondsTo(args, cb, [
                        "car", "cdr", "setCar", "setCdr", "respondsTo"
                    ]);
                    return;
                }
                cb();
                return;
            }
        };
        return obj;
    };
    exports.Kcons = Kcons;

    var Kstring = function (theString) {
        var obj = {
            equals: function (other) {
                var otherString = other.nativeString();
                return Kboolean(otherString === theString);
            },
            append: function (other) {
                var otherString = other.nativeString();
                var joinedString = theString + otherString;
                return Kstring(joinedString);
            },
            substring: function (from, to) {
                var iFrom = from.nativeInteger();
                var iTo = to.nativeInteger();
                var partString = theString.substring(iFrom, iTo);
                return Kstring(partString);
            },
            length: function () {
                return Kinteger(theString.length);
            },
            send: function (message, args, cb) {
                if (message === "equals") {
                    Ksend(args, "car", Kcons(), function (val) {
                        cb(obj.equals(val));
                    });
                    return;
                }
                if (message === "append") {
                    Ksend(args, "car", Kcons(), function (val) {
                        cb(obj.append(val));
                    });
                    return;
                }
                if (message === "substring") {
                    Ksend(args, "car", Kcons(), function (from) {
                        Ksend(args, "cdr", Kcons(), function (cdr) {
                            Ksend(args, "car", Kcons(), function (to) {
                                cb(obj.substring(from, to));
                            });
                        });
                    });
                    return;
                }
                if (message === "length") {
                    cb(obj.length());
                    return;
                }
                if (message === "respondsTo") {
                    KrespondsTo(args, cb, [
                        "respondsTo", "equals", "append", "substring", "length"
                    ]);
                    return;
                }
                cb();
                return;
            },
            nativeString: function () { return theString; }
        };
        return obj;
    };
    exports.Kstring = Kstring;

    var Kinteger = function (theInteger) {
        var obj = {
            equals: function (other) {
                var otherInteger = other.nativeInteger();
                return Kboolean(otherInteger === theInteger);
            },
            send: function (message, args, cb) {
                if (message === "equals") {
                    Ksend(args, "car", Kcons(), function (val) {
                        cb(obj.equals(val));
                        return;
                    });
                }
                if (message === "respondsTo") {
                    KrespondsTo(args, cb, [
                        "respondsTo", "equals"
                    ]);
                    return;
                }
                cb();
                return;
            },
            nativeInteger: function () { return theInteger; }
        };
        return obj;
    };
    exports.Kinteger = Kinteger;

    var Ktrue = {
        send: function (message, args, cb) {
            if (message === "not") { cb(Kfalse); return; }
            if (message === "respondsTo") {
                KrespondsTo(args, cb, [
                    "respondsTo", "not"
                ]);
                return;
            }
            cb(); return;
        }
    };
    exports.Ktrue = Ktrue;

    var Kfalse = {
        send: function (message, args, cb) {
            if (message === "not") { cb(Ktrue); return; }
            if (message === "respondsTo") {
                KrespondsTo(args, cb, [
                    "respondsTo", "not"
                ]);
                return;
            }
            cb(); return;
        }
    };
    exports.Kfalse = Kfalse;

    var Kboolean = function (theBool) {
        if (theBool) { return Ktrue; }
        else { return Kfalse; }
    };
    exports.Kboolean = Kboolean;

    var Kobject = function (codeblock) {
        var privateCons = Kcons();
        var obj = {
            send: function (message, args, cb) {
                var vars = {
                    "Kame__self": obj,
                    "Kame__message": Kstring(message),
                    "Kame__arguments": args,
                    "Kame__privateCons": privateCons,
                    "Kame__util": Kutil
                };
                var getNth = function (cons, index, cb) {
                    Ksend(Kutil,
                        "nth",
                        Kcons(cons, Kcons(Kinteger(index), null)),
                        function (val) { cb(val.nativeString()); });
                };

                var doCons = function (instruction, cb) {
                    getNth(instruction, 0, function (keyResult) {
                        getNth(instruction, 1, function (keyCar) {
                            getNth(instruction, 2, function (keyCdr) {
                                var valCar = vars[keyCar];
                                var valCdr = vars[keyCdr];
                                var valResult = Kcons(valCar, valCdr);
                                vars[keyResult] = valResult;
                                cb();
                            });
                        });
                    });
                };
                var doString = function (instruction, cb) {
                    getNth(instruction, 0, function (keyResult) {
                        getNth(instruction, 1, function (rawString) {
                            var valString = Kstring(rawString);
                            vars[keyResult] = valString;
                            cb();
                        });
                    });
                };
                var doSend = function (instruction, cb) {
                    getNth(instruction, 0, function (keyResult) {
                        getNth(instruction, 1, function (keyObj) {
                            getNth(instruction, 2, function (keyMessage) {
                                getNth(instruction, 3, function (keyArgs) {
                                    var valObj = vars[keyObj];
                                    var valArgs = vars[keyArgs];

                                    var varMessage = vars[keyMessage];
                                    var valMessage = varMessage.nativeString();
                                    var cont = function (valResult) {
                                        vars[keyResult] = valResult;
                                        cb();
                                    };
                                    Ksend(valObj, valMessage, valArgs, cont);
                                });
                            });
                        });
                    });
                };
                var doEquals = function (instruction, cb) {
                    getNth(instruction, 0, function (keyResult) {
                        getNth(instruction, 1, function (keyObjA) {
                            getNth(instruction, 2, function (keyObjB) {
                                var valResult = Kfalse;
                                var valObjA = vars[keyObjA];
                                var valObjB = vars[keyObjB];
                                if (valObjA === valObjB) {
                                    valResult = Ktrue;
                                }
                                vars[keyResult] = valResult;
                                cb();
                            });
                        });
                    });
                };
                var doIf = function (instruction, cb, finalCb) {
                    getNth(instruction, 0, function (keyBool) {
                        var valBool = vars[keyBool];
                        if (valBool === Kfalse) { cb(); return; }
                        if (valBool === Ktrue) {
                            var innerInstruction = instruction.cdr();
                            doInstruction(innerInstruction, cb, finalCb);
                            return;
                        }
                        cb();
                        return;
                    });
                };
                var doReturn = function (instruction, cb, finalCb) {
                    getNth(instruction, 0, function (keyResult) {
                        var valResult = vars[keyResult];
                        finalCb(valResult);
                    });
                };

                var doInstruction = function (instruction, cb, finalCb) {
                    var instructionType = instruction.car().nativeString();
                    var innerInstruction = instruction.cdr();
                    if (instructionType === "cons") {
                        doCons(innerInstruction, cb);
                    }
                    if (instructionType === "string") {
                        doString(innerInstruction, cb);
                    }
                    if (instructionType === "send") {
                        doSend(innerInstruction, cb);
                    }
                    if (instructionType === "equals") {
                        doEquals(innerInstruction, cb);
                    }
                    if (instructionType === "if") {
                        doIf(innerInstruction, cb, finalCb);
                    }
                    if (instructionType === "return") {
                        doReturn(innerInstruction, cb, finalCb);
                    }
                };

                var cont = function (instructions, cb) {
                    var instruction = instructions.car();
                    if (KisNull(instruction)) { cb(); return; }
                    var otherInstructions = instructions.cdr();
                    doInstruction(instruction, function () {
                        if (KisNull(otherInstructions)) { cb(); return; }
                        cont(otherInstructions, cb);
                    }, function (valResult) {
                        cb(valResult);
                    });
                };
                cont(codeblock, cb);
                return;
            }
        };
        return obj;
    };
    exports.Kobject = Kobject;

    var KlistToCons = function (nativeList, walker) {
        var result = Kcons();

        var current = result;
        for (var i = 0, l = nativeList.length; i < l; i++) {
            var item = nativeList[i];
            current.setCar(walker(item));
            if (i < l-1) { // Not the last item
                var next = Kcons();
                current.setCdr(next);
                current = next;
            }
        }

        return result;
    };
    exports.KlistToCons = KlistToCons;

    var KconsToList = function (cons, walker) {
        var result = [];

        var current = cons;
        while (!KisNull(current)) {
            result.push(walker(current.car()));
            current = current.cdr();
        }

        return result;
    };
    exports.KconsToList = KconsToList;

    var KtoNative = function (obj) {
        if (KisNull(obj)) { return null; }
        if (obj.nativeString) { return obj.nativeString(); }
        if (obj.nativeInteger) { return obj.nativeInteger(); }
        if (obj.car) { return KconsToList(obj, KtoNative); }
        if (obj === Ktrue) { return true; }
        if (obj === Kfalse) { return false; }
        if (obj.send) { return { "__type": "KameObject" }; }
    };
    exports.KtoNative = KtoNative;

    var KcodeToBlock = function (nativeCodeblock) {
        return KlistToCons(nativeCodeblock, function (nativeInstruction) {
            return KlistToCons(nativeInstruction, Kstring);
        });
    };
    exports.KcodeToBlock = KcodeToBlock;

    var KutilImplementation = {
        send: function (message, args, cb) {
            if (message === "parseInt") {
                Ksend(args, "car", Kcons(), function (val) {
                    var intString = val.nativeString();
                    var nativeInteger = 0;
                    try {
                        nativeInteger = parseInt(intString);
                    } catch (e) {
                        // Leave nativeInteger as 0
                    }
                    cb(Kinteger(nativeInteger));
                    return;
                });
                return;
            }
            if (message === "true") { cb(Ktrue); return; }
            if (message === "false") { cb(Kfalse); return; }
            if (message === "loop") {
                Ksend(args, "car", Kcons(), function (looper) {
                    Ksend(args, "cdr", Kcons(), function (cdr) {
                        Ksend(cdr, "car", Kcons(), function (msg) {
                            var keepGoing = function () {
                                Ksend(looper, msg, function (cont) {
                                    if (cont === Ktrue) { keepGoing(); }
                                    if (cont === Kfalse) { cb(); }
                                });
                            };
                            keepGoing();
                        });
                    });
                });
                return;
            }
            if (message === "async") {
                Ksend(args, "car", Kcons(), function (target) {
                    Ksend(args, "cdr", Kcons(), function (cdr) {
                        Ksend(cdr, "car", Kcons(), function (msg) {
                            Ksend(target, msg, function () {});
                        });
                    });
                });
                return;
            }
            if (message === "nth") {
                Ksend(args, "car", Kcons(), function (cons) {
                    Ksend(args, "cdr", Kcons(), function (cdr) {
                        Ksend(cdr, "car", Kcons(), function (index) {
                            var nativeIndex = index.nativeInteger();
                            if (nativeIndex === 0) {
                                Ksend(cons, "car", Kcons(), cb);
                                return;
                            }
                            var nextIndex = Kinteger(nativeIndex - 1);
                            Ksend(Kutil,
                                "nth",
                                Kcons(cons.cdr(), Kcons(nextIndex, null)),
                                cb);
                        });
                    });
                });
                return;
            }
            if (message === "object") {
                Ksend(args, "car", Kcons(), function (codeblock) {
                    cb(Kobject(codeblock));
                });
                return;
            }
            if (message === "log") {
                var theConsole = console || {};
                var log = theConsole.log || function () {};
                log(KtoNative(args, Kid));
                cb();
                return;
            }
            if (message === "respondsTo") {
                KrespondsTo(args, cb, [
                    "respondsTo",
                    "parseInt",
                    "true",
                    "false",
                    "loop",
                    "async",
                    "nth",
                    "object",
                    "log"
                ]);
                return;
            }
            cb();
            return;
        }
    };

    var Kproxy = function (theObj) {
        var innerObj = theObj;
        var obj = {
            set: function (theObj) { innerObj = theObj; },
            get: function () { return innerObj; },
            proxy: function () {
                return {
                    send: function (message, args, cb) {
                        Ksend(innerObj, message, args, cb);
                    }
                };
            },
            send: function (message, args, cb) {
                if (message === "set") {
                    Ksend(args, "car", Kcons(), function (val) {
                        obj.set(val);
                        cb();
                    });
                    return;
                }
                if (message === "get") {
                    cb(obj.get());
                    return;
                }
                if (message === "proxy") {
                    cb(obj.proxy());
                    return;
                }
                if (message === "respondsTo") {
                    KrespondsTo(args, cb, [
                        "respondsTo", "set", "get", "proxy"
                    ]);
                    return;
                }
                cb();
                return;
            }
        };
        return obj;
    };
    exports.Kproxy = Kproxy;

    var KutilProxy = Kproxy(KutilImplementation);
    exports.KutilProxy = KutilProxy;
    var Kutil = KutilProxy.proxy();
    exports.Kutil = Kutil;

    var Krun = function (code, args, cb) {
        if (!args) { args = Kcons(); }
        if (!cb) { cb = function () {}; }
        var block = KcodeToBlock(code);
        var obj = Kobject(block);
        obj.send("run", args, cb);
    };
    exports.Krun = Krun;

    return exports;
});
