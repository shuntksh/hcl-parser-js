module.exports = {
	input: "src/grammar.pegjs",
	output: "src/__generated.js",
	allowedStartRules: ["ConfigFile"],
	format: "es",
	trace: false,
	dts: true,
	returnTypes: {
		ConfigFile: "ConfigFile",
	},
};
