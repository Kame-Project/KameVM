# Kame VM

## Introduction

Kame is a virtual machine implemented initially in JavaScript. It can
securely execute arbitrary code without using over-complicated
sandboxing solutions. We simply enforce three security aspects of
object-oriented programming:

* No man-in-the-middle.
    * Within the same VM it is impossible to intercept or modify
    messages between two objects. The only exception is when an object has
    explicitly been given the authority to do so.
    * TODO: Between two different VMs we employ cryptographic measures to
    prevent MITM attacks other than service denial.
* Receiver is authenticated.
    * Once you hold a reference to another object any messages sent via
    this reference will be received by only this object. No object can fake
    the identity of another to receive their messages.
* Sender is authorized.
    * You can only obtain a reference to another object through
    creation, construction and introduction. This means that if you hold a
    reference to another object you have been explicitly granted the
    authority to send messages to that object. The receiver can rely on
    this.

### Important Notice

The VM as included here is *not* yet safe to use. Here is an example of
how you can crash your VM:

```js
<<Crash Example>>=
var vm = require('./vm');
var bytecode = [
    ["send", "_", "nothing", "nothing"]
];
var arr = vm.array.Knew();
arr.push(console.log);
var root = vm.object.Knew(vm.dictionary.Knew(), bytecode);
root.Kame__send('something', arr);
@
```

Right now this VM is very much a prototype. The interfaces need a lot of
cleanup and so does most of the implementation. The bytecode looks
stable.

### Makefile

Generate this Makefile with `notangle -RMakefile vm.noweb.md`. You'll
need to fix up the tabs afterwards.

```make
<<Makefile>>=
all:
    nountangle vm.noweb.md >vm.js
    gfm <vm.noweb.md >vm.html

demo:
    make && notangle -R'Purse Example' vm.noweb.md | node

crash:
    make && notangle -R'Crash Example' vm.noweb.md | node
@
```

## Overview of Types

The VM uses a few data types to manage its state and the code running
inside the VM.

### Object

An object is a live agent in the system. It can send and receive
messages from/to other objects. There is a single block of code which
handles all messages sent to the object. The arguments are available in
the context as an array in `Kame__arguments`. A special variable
`Kame__self` points to the receiving object so it can message itself.
`Kame__message` contains the message selector.

There is another special variable `Kame__modules` which provides an
interface to modules that are guaranteed to be safe (relative to the VM)
as they run entirely inside the VM or are part of the VM's core. The
interface is described later.

Objects are created using the `makeobject` bytecode instruction. This
instruction takes a dictionary of private variables as well as a code
block for the handler.

#### Implementation details

We store an `Object` as a `Dictionary` with two keys: `variables` and
`handler`. `variables` stores a `Dictionary` of private variables.
`handler` stores the code block.

Native JavaScript code can interface with the VM by calling `Kame__send`
on a VM object. Similary if a JavaScript object has a `Kame__send`
method and a VM object holds a reference to it then it can be accessed
from inside the VM. However the reference will be opaque and cannot be
persistent across restarts.

`null` responds with an error to every message.

<!-- {{{ -->
```js
<<VM Types: Object>>=
var object = (function () {
    var exports = {};

    function run(codeblock, self, message, arguments) {
        <<VM Runner: top-level run>>
    }

    function Knew(variables, codeblock) {
        var newObject = {};

        if (!variables.keys) {
            throw new Error("variables should be a safe dictionary");
        }
        if (!codeblock.length) {
            throw new Error("codeblock should be an array");
        }

        function getPrivate(key) {
            return variables.get(key);
        }
        newObject.getPrivate = getPrivate;

        function setPrivate(key, value) {
            variables.set(key, value);
        }
        newObject.setPrivate = setPrivate;

        function send(strMessage, arguments) {
            var message = string.from(strMessage);
            return run(codeblock, newObject, message, arguments);
        }
        newObject.Kame__send = send;

        return newObject;
    }
    exports.Knew = Knew;

    return exports;
})();
@
```
<!-- }}} -->

### Dictionary

To prevent unintended security leaks we do not use the built-in `Object`
from JavaScript as a dictionary. Instead we implement a new type that
prefixes all keys so access from inside the VM is namespaced.

<!-- {{{ -->
```js
<<VM Types: Dictionary>>=
var dictionary = (function () {
    var exports = {};

    function keysOf(dict) {
        var keys = [];
        for (var key in dict) {
            if (dict.hasOwnProperty(key)) {
                keys.push(key);
            }
        }
        return keys;
    }

    var safePrefix = 'Kame__dictionary:';

    function safeKey(key) {
        return safePrefix + key;
    }

    function Knew() {
        var dict = {};
        var insideDict = {};

        function get(key) {
            return insideDict[safeKey(key)];
        }
        dict.get = get;

        function set(key, value) {
            insideDict[safeKey(key)] = value;
        }
        dict.set = set;

        function keys() {
            var allKeys = keysOf(insideDict);
            var safeKeys = [];
            var prefixLen = safePrefix.length;
            for (var i = 0, l = allKeys.length; i < l; i++) {
                var key = allKeys[i];
                if (key.indexOf(safePrefix) === 0) {
                    var originalKey = key.slice(prefixLen);
                    safeKeys.push(originalKey);
                }
            }
            return safeKeys;
        }
        dict.keys = keys;

        function send(message, arguments) {
            var callback = arguments.get(0);
            var key = arguments.get(1);
            var strKey = key.Kame__toString();
            if (message === 'get') {
                var value = get(strKey);
                callback(value);
            }
            if (message === 'set') {
                var value = arguments.get(2);
                set(strKey, value);
                callback();
            }
        }
        dict.Kame__send = send;

        return dict;
    }
    exports.Knew = Knew;

    function from(otherDict) {
        var newDict = Knew();

        var otherKeys = keysOf(otherDict);
        for (var i = 0, l = otherKeys.length; i < l; i++) {
            var key = otherKeys[i];
            if (key.indexOf(safePrefix) === 0) {
                throw new Error("Please do not pass in safeDicts");
            }
            var value = otherDict[key];
            newDict.set(key, value);
        }

        return newDict;
    }
    exports.from = from;

    return exports;
})();
@
```
<!-- }}} -->

### Array

In a similar fashion to the `Dictionary` we implement our own safe
`Array` type. This array makes sure that only numerical indexes are
accessible.

<!-- {{{ -->
```js
<<VM Types: Array>>=
var array = (function () {
    var exports = {};

    function Knew() {
        var array = {};
        var innerArray = [];

        function get(index) {
            var nIndex = parseInt(index);
            return innerArray[nIndex];
        }
        array.get = get;

        function set(index, value) {
            var nIndex = parseInt(index);
            innerArray[nIndex] = value;
        }
        array.set = set;

        function push(value) {
            innerArray.push(value);
        }
        array.push = push;

        function length() {
            return innerArray.length;
        }
        array.length = length;

        function send(message, arguments) {
            var callback = arguments.get(0);
            var key = arguments.get(1);
            nKey = key.Kame__toNumber();
            if (message === 'get') {
                var value = get(nKey);
                callback(value);
            }
            if (message === 'set') {
                var value = arguments.get(2);
                set(nKey, value);
                callback();
            }
        }
        array.Kame__send = send;

        return array;
    }
    exports.Knew = Knew;

    return exports;
})();
@
```
<!-- }}} -->

## Bytecode Instructions

```
constant <var_name> <json_value>
load <var_name> <private_name>
store <var_name> <private_name>
send <var_result> <var_object> <var_message> <var_arg1>...<var_argN>
apply <var_result> <var_object> <var_message> <var_arguments>
makeobject <var_result> <var_dictionary> <codeblock>
equals <var_result> <var_objA> <var_objB>
if <var_bool> <instruction>
return <var_result>
```

### constant

### load

### store

### send

### apply

### makeobject

### equals

This compares object references. i.e. identity. Equality has to be
handled on an object level. Though you want to be careful as you will be
handing one of the two objects a reference to the other.

References are opaque. There is a special `null` reference which you can
create with the JSON constant `null`.

### if

### return

## Modules

### Base types

The base types can be constructed via the `constant` bytecode.

#### Base: Dictionary

* get (String key) => value
* set (String key, value)
* keys () => List of String

#### Base: List

* get (Number index) => value
* set (Number index, value)
* push (value)
* length () => Number
* contains (value) => Boolean answer

TODO `contains` is potentially difficult to implement.

#### Base: String

* get (Number index) => String character
* slice (Number startIncl, Number endExcl) => String substring
* append (String other) => String
* length () => Number
* equals (String other) => Boolean

To safely convert a string-like object to a real string object that is
guaranteed to behave correctly: `Kame__modules base string from(String
other)`

<!-- {{{ -->
```js
<<Base: String>>=
var string = (function () {
    var exports = {};

    function from(other) {
        var string = {};
        var innerString = other;
        if (typeof other !== 'string') {
            if (!other.Kame__send) {
                throw new Error("Need an object if not given a string");
            }
            function setString(length) {
                function setWholeString(wholeString) {
                    var nativeString = wholeString.Kame__toString();
                    innerString = nativeString;
                }
                var args = array.Knew();
                args.push(setWholeString);
                args.push(number.from(0));
                args.push(length);
                other.Kame__send('slice', args);
            }
            var args = array.Knew();
            args.push(setString);
            other.Kame__send('length', args);
        }

        function get(index) {
            var nIndex = parseInt(index);
            return innerString[nIndex];
        }
        string.get = get;

        function slice(startIncl, endExcl) {
            var nStart = parseInt(startIncl);
            var nEnd = parseInt(endExcl);
            return innerString.slice(nStart, nEnd);
        }
        string.slice = slice;

        function append(other) {
            return from(innerString + other);
        }
        string.append = append;

        function length() {
            return innerString.length;
        }
        string.length = length;

        function equals(other) {
            return boolean.from(innerString === other);
        }
        string.equals = equals;

        function send(message, arguments) {
            var callback = arguments.get(0);
            if (message === 'get') {
                var index = arguments.get(1);
                var nIndex = index.Kame__toNumber();
                var value = get(nIndex);
                callback(value);
            }
            if (message === 'slice') {
                var startIncl = arguments.get(1);
                var endExcl = arguments.get(2);
                var nStart = startIncl.Kame__toNumber();
                var nEnd = endExcl.Kame__toNumber();
                var value = slice(nStart, nEnd);
                callback(value);
            }
            if (message === 'append') {
                var other = arguments.get(1);
                var nativeOther = other.Kame__toString();
                var value = append(nativeOther);
                callback(value);
            }
            if (message === 'length') {
                var value = length();
                callback(value);
            }
            if (message === 'equals') {
                var other = arguments.get(1);
                var nativeOther = other.Kame__toString();
                var value = equals(nativeOther);
                callback(value);
            }
        }
        string.Kame__send = send;

        function toString() {
            return innerString;
        }
        string.Kame__toString = toString;

        return string;
    }
    exports.from = from;

    return exports;
})();
@
```
<!-- }}} -->

#### Base: Number

* `<` (Number other) => Boolean
* `>` (Number other) => Boolean
* `+` (Number other) => Number
* `-` (Number other) => Number
* `*` (Number other) => Number
* `/` (Number other) => Number
* equals (Number other) => Boolean

When given an untrusted number-like object you will likely want to
ensure that it behaves correctly: `Kame__modules base number
from(Number other)`

<!-- {{{ -->
```js
<<Base: Number>>=
var number = (function () {
    var exports = {};

    function from(other) {
        var number = {};
        var innerNumber = parseFloat(other);
        if (isNaN(parseFloat(other))) {
            if (!other.Kame__send) {
                throw new Error("Need an object if not given a number");
            }
            innerNumber = other.Kame__toNumber();
        }

        function send(message, arguments) {
            var callback = arguments.get(0);
            var other = arguments.get(1);
            var nativeOther = other.Kame__toNumber();
            switch (message) {
                case '<':
                    callback(boolean.from(innerNumber < nativeOther));
                case '>':
                    callback(boolean.from(innerNumber > nativeOther));
                case '+':
                    callback(from(innerNumber + nativeOther));
                case '-':
                    callback(from(innerNumber - nativeOther));
                case '*':
                    callback(from(innerNumber * nativeOther));
                case '/':
                    callback(from(innerNumber / nativeOther));
                default:
                    throw new Error("Invalid message: " + message);
            }
        }
        number.Kame__send = send;

        function toNumber() {
            return innerNumber;
        }
        number.Kame__toNumber = toNumber;

        return number;
    }
    exports.from = from;

    return exports;
})();
@
```
<!-- }}} -->

#### Base: Boolean

* not () => Boolean
* and (Boolean other) => Boolean
* or (Boolean other) => Boolean

<!-- {{{ -->
```js
<<Base: Boolean>>=
var boolean = (function () {
    var exports = {};

    function from(other) {
        var boolean = {};
        var innerBool = (other === true);
        if (!other && other !== false) {
            if (!other.Kame__send) {
                throw new Error("Need an object if not given a boolean");
            }
            innerBool = other.Kame__toBoolean();
        }

        function send(message, arguments) {
            var callback = arguments.get(0);
            if (message === 'not') {
                callback(from(!innerBool));
                return;
            }
            var other = arguments.get(1);
            var nativeOther = other.Kame__toBoolean();
            switch (message) {
                case 'and':
                    callback(boolean.from(innerBoolean && nativeOther));
                case 'or':
                    callback(boolean.from(innerBoolean || nativeOther));
                default:
                    throw new Error("Invalid message: " + message);
            }
        }
        boolean.Kame__send = send;

        function toBoolean() {
            return innerBool;
        }
        boolean.Kame__toBoolean = toBoolean;

        return boolean;
    }
    exports.from = from;

    return exports;
})();
@
```
<!-- }}} -->

### Enhanced types

These are enhanced versions of the base types that are implemented
inside the VM on top of the base types. The enhanced types can be
constructed via `Kame__modules enhanced`.

### General utilities

#### Utility: Date

#### Utility: Slot

### Security utilities

#### Security: One-shot proxy

Only allow one message and then disable yourself.

#### Security: Restricted proxy

Only allow messages on a whitelist.

#### Security: Revocable proxy

### On testing for equality

If you have two object references and would like to test the objects for
equality you need to be careful unless they are both trusted. When you
send `equals` or an equivalent message you are handing on of the objects
a reference to the other. Before to send the message to the trusted
object if one of them is trusted. If both objects are untrusted then you
are in a tough spot.

## VM Interface

### Inside

### Outside

## Conventions

## Running the Bytecode

Callback as first arg.

Document mechanism for converting between VM and native values.

<!-- {{{ -->
```js
<<VM Runner: top-level run>>=
// codeblock, self, message, arguments
var callback = arguments.get(0);
var instructionCount = codeblock.length;
var values = dictionary.Knew();

values.set('Kame__self', self);
values.set('Kame__message', message);
values.set('Kame__arguments', arguments);

function continueAt(atInstruction) {
    function runInstruction(instruction, cb) {
        var type = instruction[0];
        var var_name = instruction[1];

        // constant <var_name> <json_value>
        if (type === 'constant') {
            function convertDict(dict) {
                var result = dictionary.from(dict);
                var keys = result.keys();
                while (keys.length > 0) {
                    var key = keys.pop();
                    var item = result.get(key);
                    result.set(key, convertAny(item));
                }
                return result;
            }
            function convertList(lst) {
                var result = array.Knew();
                while (lst.length > 0) {
                    var item = lst.pop();
                    result.push(convertAny(item));
                }
                return result;
            }
            function convertString(str) {
                return string.from(str);
            }
            function convertNumber(num) {
                return number.from(num);
            }
            function convertBoolean(bool) {
                return boolean.from(bool);
            }
            function convertAny(any) {
                if (typeof any === 'string') {
                    return convertString(any);
                }
                if (!isNaN(parseFloat(any))) {
                    return convertNumber(any);
                }
                if (any === true || any == false) {
                    return convertBoolean(any);
                }
                if (any === null) {
                    return null;
                }
                if (any && any.length) {
                    return convertList(any);
                }
                return convertDict(any);
            }

            var json_value = instruction[2];
            var safe_value = convertAny(json_value);
            values.set(var_name, safe_value);
            cb();
        }

        // load <var_name> <private_name>
        if (type === 'load') {
            var private_name = instruction[2];
            var value = self.getPrivate(private_name);
            values.set(var_name, value);
            cb();
        }

        // store <var_name> <private_name>
        if (type === 'store') {
            var private_name = instruction[2];
            var value = values.get(var_name);
            self.setPrivate(private_name, value);
            cb();
        }

        // send <var_result> <var_object> <var_message> <var_arg1>...<var_argN>
        if (type === 'send') {
            var theObject = instruction[2];
            var message = instruction[3];
            var args = instruction.slice(4);
            var safeArgs = array.Knew();
            while (args.length > 0) {
                safeArgs.push(args.pop());
            }
            values.set('Kame__temp', safeArgs);
            runInstruction(
                ['apply', var_name, theObject, message, 'Kame__temp'], cb);
        }

        // apply <var_result> <var_object> <var_message> <var_arguments>
        if (type === 'apply') {
            var var_object = instruction[2];
            var var_message = instruction[3];
            var var_args = instruction[4];
            var theObject = values.get(var_object);
            var message = values.get(var_message);
            var args = values.get(var_args);
            var strMessage = message.Kame__toString();
            var cpsArgs = array.Knew();
            function then(value) {
                values.set(var_name, value);
                cb();
            }
            cpsArgs.push(then);
            for (var i = 0, l = args.length(); i < l; i++) {
                var key = args.get(l-i-1);
                var value = values.get(key);
                cpsArgs.push(value);
            }
            theObject.Kame__send(strMessage, cpsArgs);
        }

        // makeobject <var_result> <var_dictionary> <codeblock>
        if (type === 'makeobject') {
            var var_dictionary = instruction[2];
            var codeblock = instruction[3];
            var newDictionary = values.get(var_dictionary);
            var newObject = object.Knew(newDictionary, codeblock);
            values.set(var_name, newObject);
            cb();
        }

        // equals <var_result> <var_objA> <var_objB>
        if (type === 'equals') {
            var var_objA = instruction[2];
            var var_objB = instruction[3];
            var objA = values.get(var_objA);
            var objB = values.get(var_objB);
            var nativeResult = (objA === objB);
            runInstruction(['constant', var_name, nativeResult], cb);
        }

        // if <var_bool> <instruction>
        if (type === 'if') {
            var newBoolean = values.get(var_name);
            var nativeBool = newBoolean.Kame__toBoolean();
            if (nativeBool) {
                var realInstruction = instruction.slice(2);
                runInstruction(realInstruction, cb);
            } else {
                cb();
            }
        }

        // return <var_result>
        if (type === 'return') {
            var value = values.get(var_name);
            callback(value);
            cb();
        }
    }

    if (atInstruction >= instructionCount) {
        return;
    }
    var instruction = codeblock[atInstruction];
    function then() {
        continueAt(atInstruction+1);
    }
    runInstruction(instruction, then);
}
continueAt(0);
@
```
<!-- }}} -->

## Putting it All Together

```js
<<*>>=
(function (root, factory) {
    if (typeof exports === "object" && exports) {
        module.exports = factory(); // CommonJS
    } else if (typeof define === "function" && define.amd) {
        define(factory); // AMD (RequireJS and family)
    } else {
        root.Kame = factory(); // Browser <script>
    }
}(this, (function () {

    var exports = {};

    exports.name = "Kame";
    exports.version = "0.0.0";

    <<Base: String>>
    exports.string = string;

    <<Base: Number>>
    exports.number = number;

    <<Base: Boolean>>
    exports.boolean = boolean;

    <<VM Types: Dictionary>>
    exports.dictionary = dictionary;

    <<VM Types: Array>>
    exports.array = array;

    <<VM Types: Object>>
    exports.object = object;

    return exports;

})));
@
```

### CPS Transform

The VM automatically does a CPS transform on any bytecode. The first
argument is a callback that is called with the return value.

TODO actually it doesn't right now. It just uses a CPS style in the
implementation.

TODO go into detail about the concurrency issues that can appear.

## Examples

### Purses

We want to create a set of purses that hold some form of electronic
credits which can be exchanged. The interface for a Purse-like object
supports:

* getBalance => Number amount
* withdraw (Number amount) => Purse
* deposit (Purse other)
* willVerify

When depositing from another purse the target purse needs to verify that
`Purse other` is behaving according to the rules in this contract.
Otherwise you could construct a new object that pretends to be a purse
with some balance.

Other objects may also want to verify the validity of a purse. Once
purses are able to verify each other this is as simple as creating a new
empty purse and depositing the purse to be verified into it. If the
deposit succeeds and yields the appropriate balance then the foreign
purse was valid.

```
<<Purse Example: Purse handler>>=
["constant", "getBalance", "getBalance"],
["constant", "withdraw", "withdraw"],
["constant", "deposit", "deposit"],
["constant", "willVerify", "willVerify"],
["constant", "equals", "equals"],
["load", "balance", "balance"],
["load", "verifier", "verifier"],
["load", "factory", "factory"],

["send", "isGetBalance", "getBalance", "equals", "Kame__message"],
["if", "isGetBalance", "return", "balance"],

["send", "isWithdraw", "withdraw", "equals", "Kame__message"],
["if", "isWithdraw", "constant", "one", 1],
["if", "isWithdraw", "constant", "greaterThan", ">"],
["if", "isWithdraw", "constant", "not", "not"],
["if", "isWithdraw", "constant", "null", null],
["if", "isWithdraw", "constant", "minus", "-"],
["if", "isWithdraw", "constant", "get", "get"],
["if", "isWithdraw", "send", "amount", "Kame__arguments", "get", "one"],
["if", "isWithdraw", "send", "haveEnough", "balance", "greaterThan", "amount"],
["if", "isWithdraw", "send", "notEnough", "haveEnough", "not"],
["if", "isWithdraw", "if", "notEnough", "return", "null"],
["if", "isWithdraw", "send", "newPurse", "factory", "makePurse", "amount"],
["if", "isWithdraw", "send", "newBalance", "balance", "minus", "amount"],
["if", "isWithdraw", "store", "newBalance", "balance"],
["if", "isWithdraw", "return", "newPurse"],

["send", "isDeposit", "deposit", "equals", "Kame__message"],
["if", "isDeposit", "constant", "one", 1],
["if", "isDeposit", "constant", "get", "get"],
["if", "isDeposit", "constant", "isAuthentic", "isAuthentic"],
["if", "isDeposit", "constant", "not", "not"],
["if", "isDeposit", "constant", "null", null],
["if", "isDeposit", "constant", "plus", "+"],
["if", "isDeposit", "send", "otherPurse", "Kame__arguments", "get", "one"],
["if", "isDeposit", "send", "_", "otherPurse", "willVerify"],
["if", "isDeposit", "send", "proceed", "verifier", "isAuthentic", "otherPurse"],
["if", "isDeposit", "send", "stop", "proceed", "not"],
["if", "isDeposit", "if", "stop", "return", "null"],
["if", "isDeposit", "send", "otherBalance", "otherPurse", "balance"],
["if", "isDeposit", "send", "newPurse", "otherPurse", "withdraw", "otherBalance"],
["if", "isDeposit", "send", "newBalance", "balance", "plus", "otherBalance"],
["if", "isDeposit", "return", "newBalance"],

["send", "isWillVerify", "willVerify", "equals", "Kame__message"],
["if", "isWillVerify", "constant", "remember", "remember"],
["if", "isWillVerify", "constant", "null", null],
["if", "isWillVerify", "send", "_", "verifier", "remember", "Kame__self"],
["if", "isWillVerify", "return", "null"]
@
```

#### Creating a purse

We define a purse factory that can create new purses. This is similar to
a national bank that can print cash. The interface is very simple:

* makePurse (Number balance) => Purse

```
<<Purse Example: Purse factory handler>>=
["constant", "makePurse", "makePurse"],
["constant", "equals", "equals"],
["load", "verifier", "verifier"],

["constant", "null", null],
["equals", "needVerifier", "verifier", "null"],
["if", "needVerifier", "constant", "emptyDict", {}],
["if", "needVerifier", "makeobject", "newVerifier", "emptyDict", [
                    <<Purse Example: Verifier handler>>
                ] ],
["if", "needVerifier", "store", "newVerifier", "verifier"],
["if", "needVerifier", "load", "verifier", "verifier"],

["send", "isMakePurse", "makePurse", "equals", "Kame__message"],
["if", "isMakePurse", "constant", "variables", {}],
["if", "isMakePurse", "constant", "set", "set"],
["if", "isMakePurse", "constant", "keyVerifier", "verifier"],
["if", "isMakePurse", "constant", "keyFactory", "factory"],
["if", "isMakePurse", "constant", "keyBalance", "balance"],
["if", "isMakePurse", "constant", "one", 1],
["if", "isMakePurse", "constant", "get", "get"],
["if", "isMakePurse", "send", "balance", "Kame__arguments", "get", "one"],
["if", "isMakePurse", "send", "_", "variables", "set", "keyVerifier", "verifier"],
["if", "isMakePurse", "send", "_", "variables", "set", "keyFactory", "factory"],
["if", "isMakePurse", "send", "_", "variables", "set", "keyBalance", "balance"],
["if", "isMakePurse", "makeobject", "newPurse", "variables", [
                   <<Purse Example: Purse handler>>
               ] ],
["if", "isMakePurse", "return", "newPurse"]
@
```

#### Mutual verification between purses

In order for purses to verify each other there needs to be a trusted
third-party object that both purses have previously obtained a reference
to. If there were no trusted third-party to "root" the trust chain then
any object that behaves correctly would be indistinguishable from an
authentic purse.

We create a "verifier" object. Every legitimate purse holds a reference
to this verifier. When purse A wants to prove its legitimacy to purse B
then purse A instructs the verifier to remember purse A's reference.
Purse B in turn asks the verifier whether it knows purse A's reference.
The verifier then responds positively.

If we do not have the verifier store the direct reference to purse A
then a man-in-the-middle attack would be possible using a proxy in front
of purse A.

The verifier has this interface:

* remember (Purse prover)
* isAuthentic (Purse prover) => Boolean

```
<<Purse Example: Verifier handler>>=
["constant", "remember", "remember"],
["constant", "isAuthentic", "isAuthentic"],
["constant", "equals", "equals"],
["load", "purses", "purses"],

["constant", "null", null],
["equals", "needPurseList", "purses", "null"],
["if", "needPurseList", "constant", "newList", []],
["if", "needPurseList", "store", "newList", "purses"],
["if", "needPurseList", "load", "purses", "purses"],

["send", "isRemember", "remember", "equals", "Kame__message"],
["if", "isRemember", "constant", "push", "push"],
["if", "isRemember", "constant", "one", 1],
["if", "isRemember", "constant", "get", "get"],
["if", "isRemember", "send", "thePurse", "Kame__arguments", "get", "one"],
["if", "isRemember", "send", "_", "purses", "push", "thePurse"],
["if", "isRemember", "return", "null"],

["send", "isIsAuthentic", "isAuthentic", "equals", "Kame__message"],
["if", "isIsAuthentic", "constant", "one", 1],
["if", "isIsAuthentic", "constant", "get", "get"],
["if", "isIsAuthentic", "constant", "contains", "contains"],
["if", "isIsAuthentic", "send", "thePurse", "Kame__arguments", "get", "one"],
["if", "isIsAuthentic", "send", "answer", "purses", "contains", "thePurse"],
["if", "isIsAuthentic", "return", "answer"]
@
```

#### Putting it all together

```
<<Purse Example>>=
var vm = require('./vm');
var bytecode = [ <<Purse Example: Purse factory handler>> ];
var arr = vm.array.Knew();
arr.push(function (purseA) {
    console.log(purseA.getPrivate('balance').Kame__toNumber());
});
arr.push(vm.number.from(5));
var factory = vm.object.Knew(vm.dictionary.Knew(), bytecode);
factory.Kame__send('makePurse', arr);
@
```

<!--
Local Variables:
mode: gfm
End:

vim: fdm=marker
-->
