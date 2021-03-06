# Kame VM

## NOTICE

This documentation isn't up-to-date with `kame.js`.

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

## Bytecode Instructions

```
string <var_name> <string_value>
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

The `string_value` is a raw string embedded in the bytecode.

This value is translated to a VM object and stored under the identifer
given by `var_name`.

### load

Load the object's private variable `private_name` and stores it under
the identifier `var_name`. `null` if the private variable does not
exist.

### store

Store the value from the identifier `var_name` under the object's
private variable `private_name`. `null` if there is no value under that
identifier.

### send

Sends the message stored under `var_message` to the object stored under
`var_object` with the arguments stored under `var_arg1` through
`var_argN`. Stores the result under the identifer `var_result`.

### apply

Sends the message stored under `var_message` to the object stored under
`var_object` with the arguments values (not identifiers) stored as a
list under `var_arguments`. Stores the result under the identifier
`var_result`.

### makeobject

Creates a new object. The private variables are created from the
dictionary at `var_dictionary`. The keys map to identifiers of private
variables and the values to their respective values. The `codeblock` is
used as the handler for messages sent to the new object. The new object
is stored under `var_result`.

### equals

This compares object references. i.e. identity. The result is stored as
a boolean under `var_result`.

Equality has to be handled on an object level. You will want to be
careful as you will be handing one of the two objects a reference to the
other.

Beyond comparing with `equals` references are opaque.

### if

If the boolean stored under `var_bool` is true then execute the
instruction. Otherwise do nothing. The instruction can be of any type
including another `if`.

### return

Return the value under `var_result` to the calling object. This
immediately exists the handler and no further instructions are
executed. This can be used to return early from a handler.

## Objects

### From inside the VM

Objects respond to at least one message: `respondsTo`. They should
respond with a boolean indicating whether they are able to respond to
that message.

If there is a problem processing a message then an object would
typically return an error. This is a convention but not a strict
requirement. An error object responds to `isError` and responds
`true`. If an object wants to return an error object as part of normal
processing e.g. to construct a new error then you will need to
coordinate with the caller. One possibility is to create an _inactive_
error object that initially responds to `isError` with `false` but on
activation through the `activate` message responds with `true` to future
`isError` messages.

Every object has an attached handler that is a list of bytecode
instructions. This handler is called for every message sent to the
object. The handler can access the object's private variables as well as
a temporary context available until the handler finishes executing. In
this context there are four special variables available:

* Kame__self
* Kame__message
* Kame__arguments
* Kame__modules

`Kame__self` points to the receiving object so the handler can send a
message to itself or send its own reference to another
object. `Kame__message` contains a string with the name of the message
that was sent. `Kame__arguments` contains a list of the arguments
sent. `Kame__modules` provides an interface to modules that are part of
the VM's core. The interface for `Kame__modules` is described later.

If the handler runs to the end without returning a value then `null`
will be returned automatically. A `null` reference responds to every
message send with an error.

### From outside the VM

A VM object has a `Kame__type` attribute that can be one of these
strings:

* `"string"`
* `"number"`
* `"dictionary"`
* `"list"`
* `"boolean"`
* `"object"`

Every VM object also has a `Kame__send()` method. This method takes a
native string for the message and a VM list for the arguments. It takes
a third parameter `callback` that will be called with the return value
once the message has been processed.

On every VM object except where `Kame__type = "object"` there is a
`Kame__toNative()` method that provides a native value (native string,
native number, etc).

The `string`, `number`, etc. objects can be constructed using
`Kame__string("a string")`, `Kame__number(42)`, etc.

TODO: Dictionary check `hasOwnProperty` for security!

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
