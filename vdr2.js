// record NMEA data to file
// Uses OCPN for navigational data so it works whatever its source (N2K, SignalK etc.)

omit = [	// NMEA0183 sentences to omit
	"GLL",	// taken from OCPN navigation
	"HDG",	// taken from OCPN navigation
	"VTG",	// taken from OCPN navigation
	"GGA"	// using GLL instead
	// add here any others to be omitted
	];

logToDisplay = false;	// data will appear in the output pane
logToFile = true;		// data added to file

n2kConverters = {
	// Link NMEA2k pgns to their coverter function
	128267: convert128267,	// depth
	130306: convert130306	// wind
	};

const scriptVersion = 1.0;

// Declarations in outermost scope
const scriptName = "VDR2";
consoleName(scriptName);
const sender = "VL";	// NMEA0183 sender for generated sentences
const dialogueCaption = [{type:"caption", value:scriptName}];
var options;
var nmeaStash = {};
var n2kStash = {};
var n2Kobjects = {};	// to hold the NMEA2000 objects
var logFile;		// the log file object
var intervalIndex;	// indexes into dialogues declared in outer scope
var fileModeIndex;


// debugging settings
trace = false;
trace2k = false;	// trace just in N2K
// _remember = undefined;	// uncomment to force first time - normally commented out
if (!trace && !trace2k) consolePark();
checkVersion();
if (!logToFile) advise(10, "Writing to file disabled");
// set ourselves up
Position = require("Position");
File = require("File");
NMEA2000 = require("NMEA2000");
onExit(tidyUp);
getOptions();
haveN2k = setupN2k();	// set true if we have N2k connection

// decide on initial action
if (options.fileString == "") chooseFile();	// if no file, force selection
else {
	if (options.status == "recording"){	// must have quit while recording
		if (options.autoStart) {
			advise(5, "Recording resumed");
			startRecording("Append (auto start)");
			}
		else	options.status = "stopped";
		}
	else	options.status = "stopped";
	onCloseButton(actionDialogue);
	}
// end of start up

function chooseFile(){
	if (trace) print("In chooseFile\n");
	dialogue = [].concat(dialogueCaption);
	existingFile = options.fileString;
	if (existingFile == "") existingFile = "No recording file selected";
	dialogue.push({type:"text", width:1000, value: existingFile});
	dialogue.push({type: "radio", value:["New", "Overwrite", "Append"]});
	dialogue.push({type: "button", label:["Quit", "Dismiss", "Choose file"]});
	if (trace) print(dialogue, "\n");
	onDialogue(chooseFileResponse, dialogue);
	}

function chooseFileResponse(response){
	if (trace) print("In chooseFileResponse\n");
	button = response[response.length-1].label;
	if (button == "Quit") stopScript("Quit");
	else if (button == "Dismiss") 	onCloseButton(actionDialogue);
	else if (button == "Choose file"){
		if (trace) print("To choose file\n");
		access = response[2].value;
		if (access == "New") options.mode = WRITE_EXCL;
		else if (access == "Overwrite") options.mode = WRITE;
		else if (access == "Append") options.mode = APPEND;
		else throw("Logic error 2 in chooseFile");
		try {
			options.fileString = getFileString("??", options.mode);
			}
		catch(err){	// likely cancelled
			chooseFile();
			return;
			}
		actionDialogue();
		}
	else throw("Logic error 2 in chooseFile");
	};
	
function actionDialogue(){
	if (trace) print("In actionDialogue\n");
	if (options.fileString == "") {
		chooseFile();
		return;
		}
	dialogue = [].concat(dialogueCaption);
	dialogue.push({type:"text", width:1000, value: "File: " + options.fileString});
	switch (options.status){
		case "recording":
			buttons = ["Stop script", "Dismiss", "Pause", "End"];
			break;
		case "paused":
			buttons = ["Stop script", "Dismiss", "Resume", "End"];
			break;
		case "stopped":
			buttons = ["Stop script", "Dismiss", "Record"];
			}
	if ((options.status != "recording")  && (options.status != "paused")){
		dialogue.push({type: "button", label:"Change file"});
		dialogue.push({type: "hLine"});
		}
	if ((options.status == "paused") || (options.status == "stopped")){
		intervalIndex = dialogue.length;
		dialogue.push({	type:"field", label:"Recording every", width:50,value:(options.interval), suffix:"seconds"});
		}
	if ((options.status == "paused") || (options.status == "stopped")){
		distanceIndex = dialogue.length;
		dialogue.push({	type:"field", label:"Minimum distance", width:60,value:(options.distance), suffix:"nm"});
		}
	if ((options.status != "recording")  && (options.status != "paused")){
		fileModeIndex = dialogue.length;
		dialogue.push({type:"radio", value:["Overwrite", (options.mode == APPEND)?"*Append":"Append", "Append (auto start)"]});
		}
	dialogue.push({type: "button", label:buttons});
	onDialogue(actionResponse, dialogue);
	}

function actionResponse(response){
	if (trace) print("In actionResponse\n");
	button = response[response.length-1].label;
	switch (button){
		case "Stop script": stopScript("Script stopped");
		case "Dismiss":
			break;
		case "End":
			onSeconds();	// cancel timers
			OCPNonNMEA0183();
			OCPNonNMEA2000();
			delete logFile;	//closes - does not delete file
			options.status = "stopped"
			consoleName(scriptName + "_" + options.status);
			break;
		case "Pause":
			onSeconds();	// cancel timers
			OCPNonNMEA0183();	// and inputs
			OCPNonNMEA2000();
			options.status = "paused";
			consoleName(scriptName + "_" + options.status);
			actionDialogue();
			return;
		case "Record":
			how = response[fileModeIndex].value;
			options.interval = Number(response[intervalIndex].value);	// pick up interval
			if (options.interval < 1) options.interval = 1;	// minimum recording interval
			options.distance = Number(response[distanceIndex].value);	// pick up minimum distance
			if (options.distance < 0) options.distance = 0;
			startRecording(how);
			break;
		case "Resume":
			options.interval = Number(response[intervalIndex].value);	// pick up interval
			if (options.interval < 1) options.interval = 1;	// minimum recording interval
			options.distance = Number(response[distanceIndex].value);	// pick up minimum distance
			if (options.distance < 0) options.distance = 0;
			resumeRecording();
			break;
		case "Change file":
			chooseFile();
			return;	// do not fall through to avoid extra call to onCloseButton 
		}
	onCloseButton(actionDialogue);
	}

function startRecording(how){
	if (trace) print("startRecording ", how,"\n");
	if (how == "Overwrite") mode = WRITE;
	else mode = APPEND;
	options.autoStart = (how == "Append (auto start)")?true:false
	logFile = new File(options.fileString, mode);
	options.status = "recording";
	consoleName(scriptName+ "_"  + options.status);
	nmeaBuffer = {};
	OCPNonAllNMEA0183(nmea0183Capture);
	startN2k();
	onAllSeconds(capture, options.interval);
	}

function resumeRecording(){
	if (trace) print("resumeRecording\n");
	options.status = "recording";
	consoleName(scriptName+ "_"  + options.status);
	OCPNonAllNMEA0183(nmea0183Capture);
	startN2k();
	onAllSeconds(capture, options.interval);
	}

function startN2k(){	// start listening for N2K	
	if (haveN2k){
		pgns = Object.keys(n2kConverters);
		for (var i = 0; i < pgns.length; i++) OCPNonAllNMEA2000(n2kCapture, Number(pgns[i]));
		}
	}

function nmea0183Capture(input){	// receive NMEA0183
	if (trace) print("In nmeaCapture\n");
	if (!input.OK) return;
	id = input.value.substr(1,5);
	for (var i = 0; i < omit.length; i++) {
		if (id.substr(2,3) == omit[i]) return;
		}
	nmeaStash[id] = input.value;
	}

function n2kCapture(payload, pgn){	// stashes the n2k payloads for each pgn
	n2kStash[pgn] = payload;
	}
	
function capture(){
	if (trace) print("In capture\n");
	thisMoment = new Date();
	moment = thisMoment.toTimeString();
	UTC = moment.slice(0,2) + moment.slice(3,5) + moment.slice(6,12);
	buffer = "";
	navData = OCPNgetNavigation();
	if (trace) print(navData, "\nLast position: ", options.lastPosition, "\n");
	if (options.lastPosition && OCPNgetVectorPP(navData.position, options.lastPosition).distance < options.distance){
		if (trace) print("Not moved enough to record\n");
		return;
		}
	else options.lastPosition = navData.position;
	sentence = "$" + sender + "GLL," + new Position(navData.position).NMEA + "," + UTC + ",A,A";
	buffer += sentence + "*" + NMEA0183checksum (sentence) + "\n";
	// if stationary, COG and HDG might not be valid numbers - avoid including them.
	if (!isNaN(navData.COG)){
		sentence = "$" + sender + "VTG," + navData.COG + ",T,,M," + navData.SOG + ",N,,K,A";
		buffer += sentence + "*" + NMEA0183checksum (sentence) + "\n";
		}
	if (!isNaN(navData.HDM)){
		sentence = "$" + sender +"HDG," + navData.HDM + ",,,"  + Math.abs(navData.variation) + "," + ((navData.variation < 0)?"W":"E");
		buffer += sentence + "*" + NMEA0183checksum (sentence) + "\n";
		}

	// process the stashed NMEA0183 data
	keys =  Object.keys(nmeaStash);
	for (var i = 0; i < keys.length; i++){
		sentence = nmeaStash[keys[i]];
		buffer += "$" + sentence + "*" + NMEA0183checksum(sentence) + "\n";
		}
	nmeaStash = {};

	// process the stashed N2k data
	// uncomment next lines two inject simuated data for debugging
//	n2kStash[128267] = [147,19,255,11,245,1,255,255,155,107,24,19,8,255,90,1,0,0,50,251,255];	// water depth
//	n2kStash[130306] = [147,19,255,2,253,1,255,255,220,107,24,19,6,255,220,5,188,122,251];		// wind

	keys =  Object.keys(n2kStash);
	if (trace2k) print("N2k keys: ", keys, "\n");
	for (var i = 0; i < keys.length; i++){
		key = Number(keys[i]);
		payload = n2kStash[key];
		if (trace2k) print(i, "\t", key, "\t", payload, "\n");
		decoded = n2Kobjects[key].decode(payload);
		n2kConverters[key](decoded);
		}
	n2kStash = {};
	if (logToDisplay) print(buffer);
	if (logToFile) logFile.writeText(buffer);
	}

function setupN2k(){	// returns true if have N2K else false
	// check for N2K port
	handles = OCPNgetActiveDriverHandles();
	found = false;
	for (h = 0; h < handles.length; h++){
		attributes = OCPNgetDriverAttributes(handles[h]);
		if (attributes.protocol == "nmea2000"){
			found= true;
			continue;
			}
		}
	if (trace2k) print("N2K port ", found?"found":"not found", "\n");
	if (!found) return false;
	var keys = Object.keys(n2kConverters);
	for (var i = 0; i <keys.length; i++){
		pgn = Number(keys[i]);
		n2Kobjects[pgn] = new NMEA2000(pgn);
		if (trace2k) print("Created NMEA2000 object for PGN ", pgn, "\t", n2Kobjects[pgn].id, "\n");
		}
	return true;
	}

function convert128267(obj){	// depth
	var sentence;
	if (trace2k) print(JSON.stringify(obj, null, "\t"), "\n");
	mtof  = 3.28084;	// metres to feet
	depth = Number(obj.depth);
	depthf = depth * mtof;	// feet
	depthF = depthf/6;		// Fathoms
	sentence = "$" + sender +"DBT," + depthf.toFixed(2) + ",f," + depth.toFixed(2) + ",M," + depthF.toFixed(3) + ",F";
	buffer += sentence + "*" + NMEA0183checksum(sentence) + "\n";
	depth -= obj.offset;	// depth below surface
	depthf = depth * mtof;
	depthF = depthF/6;
	sentence = "$" + sender +"DBS," + depthf.toFixed(2) + ",f," + depth.toFixed(2) + ",M," + depthF.toFixed(3) + ",F";
	buffer += sentence + "*" + NMEA0183checksum(sentence) + "\n";
	}

function convert130306(obj){	// wind
	var sentence;
	if (trace2k) print(JSON.stringify(obj, null, "\t"), "\n");
	angle = obj.windAngle * 57.29578;	// angle from radians to degrees
	speed = obj.windSpeed * 1.943844;	// speed from m/s to knots
	sentence = "$" + sender +"MWV," +angle.toFixed(2) + ",R," + speed.toFixed(2) + ",K,A";
	buffer += sentence + "*" + NMEA0183checksum(sentence) + "\n";
	}
	
function getOptions(){
	// restore our preferences, if saved
	if (trace) print("_remember\n", JSON.stringify(_remember, null, "\t"), "\n");
	if (_remember == undefined) _remember = {};
	if (!_remember.hasOwnProperty(scriptName)){ //first time set up
		if (trace) print("First time\n");
		_remember[scriptName] = scriptName;	// our fingerprint in _remember
		_remember.options = {
			fileString:"",			// file string for recording
			interval: 30,			// recording interval in seconds
			distance: 0.02,			// minimum distance between records
			lastPosition: false,	// position at last recordings
			status: "stopped",
			autoStart: false
			}
		advise(10, "To call up the settings panel\nwhen script is running\nclick on the console close button");
		}
	options = _remember.options;	// for convenience
	}

function advise(time, message){	// timed alert
	alert(message);
	onSeconds(cancelAlert, time);
	}

function cancelAlert(){
	alert(false);
	}

function tidyUp(){
	consoleName(scriptName);
	}

function checkVersion(){
	if (OCPNgetPluginConfig().PluginVersionMajor < 3) throw(scriptName + " requires plugin v3 or later.");
	if (!OCPNisOnline()) return;
	if (_remember == undefined) _remember = {};
	now = Date.now();
	if (trace) print("Now: ", now, "\n");
	if (_remember.hasOwnProperty("versionControl")){
		lastCheck = _remember.versionControl.lastCheck;
		if (trace) print("versionControl.lastCheck was ", lastCheck, "\n");
		checkDays = 2;	// how often to check

		if (now < (lastCheck + checkDays*24*60*60*1000)){
			if (trace) print("No version check due\n");
			return;
			}
		_remember.versionControl.lastCheck = now;
		}
	else _remember.versionControl = {"lastCheck":0};
	if (trace) print("versionControl.lastCheck updated to ", now, "\n");
	versionCheckURL = "https://raw.githubusercontent.com/antipole2/VDR2/main/version.JSON";
	scriptURL = "https://raw.githubusercontent.com/antipole2/VDR2/main/vdr2.js"
	details = JSON.parse(readTextFile(versionCheckURL));
	if (scriptVersion < details.version){
		message = "\You have script version " + scriptVersion
			+ "\nUpdate to version " + details.version + " available."
			+ "\nDate: " + details.date + "\nNew: " + details.new
			+ "\n \nUpdating will lose any local changes you have made\nYou need to save these first"
			+ "\nTo supress update prompts, disable the call to checkVersion"
			+ "\nUpdate now?";
		response = messageBox(message, "YesNo");
		if (response == 2){
			require("Consoles");
			consoleLoad(consoleName(), scriptURL);
			message = "Script updated.\nYou need to save it locally if you want to run it off-line"
				+ "\nYou can now run the updated script.";
			messageBox(message);
			stopScript("Script updated");
			}
		else _remember.versionControl.lastCheck = now;
		}
	else if (trace) print("Version already up to date\n");
	}
