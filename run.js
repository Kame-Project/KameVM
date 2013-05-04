var fs = require("fs");
var kame = require("./kame");

var reachedFilenames = false;
var globalCons = kame.Kcons();
process.argv.forEach(function (arg) {
    if (reachedFilenames) {
        var filename = arg;
        var json = fs.readFileSync(filename);
        var code = JSON.parse(json);
        kame.Krun(code, kame.Kcons(globalCons, null));
    }
    if (arg === "--") {
        reachedFilenames = true;
    }
});
