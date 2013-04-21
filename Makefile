all:
	nountangle vm.noweb.md >vm.js
	gfm <vm.noweb.md >vm.html

demo:
	make && notangle -R'Purse Example' vm.noweb.md | node

crash:
	make && notangle -R'Crash Example' vm.noweb.md | node
