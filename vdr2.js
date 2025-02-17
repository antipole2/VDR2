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

const scriptName = "VDR2";
const scriptVersion = "1.2";
consoleName(scriptName);
require("pluginVersion")("3.1.1");
require("checkForUpdate")(scriptName, scriptVersion, 0, "https://raw.githubusercontent.com/antipole2/VDR2/main/version.JSON");

// Declarations in outermost scope
const sender = "VL";	// NMEA0183 sender for generated sentences
const dialogueCaption = [{type:"caption", value:scriptName}];
File = require("File");
var options;
var nmeaStash = {};
var n2kStash = {};
var n2Kobjects = {};	// to hold the NMEA2000 objects
var logFile = false;		// the log file object
var intervalIndex;	// indexes into dialogues declared in outer scope
var fileModeIndex;
var autoIndex;

// debugging settings
trace = false;
trace2k = false;	// trace just in N2K
// _remember = undefined;	// uncomment to force first time - normally commented out
if (!trace && !trace2k) consolePark();
if (!logToFile) advise(10, "Writing to file disabled");
// set ourselves up
Position = require("Position");
File = require("File");
NMEA2000 = require("NMEA2000");
onExit(tidyUp);
getOptions();
haveN2k = setupN2k();	// set true if we have N2k connection
if (trace) print(options, "\n");

// decide on initial action
if (options.status == "firstTime"){
	options.status = "stopped";
	mainDialogue();
	}
else if (options.status == "recording"){	// must have quit while recording
	if (options.autoStart) {
		if (trace) print("Resuming recordings\n");
		advise(10, "Recording resumed");
		startRecording(options.fileString, APPEND);
		}
	else	options.status = "stopped";
	}
else	{
	options.status = "stopped";
	onCloseButton();	// work around for JS v3.0.1 - fixed in next
	onCloseButton(mainDialogue);
	}
// end of start up	

function startRecording(fileString, mode){
	if (trace) print("startRecording ", fileString, "\t", mode,"\n");
	// for unknown reasons, fileString needs to be in wider context variaable
	options.fileString = fileString;
	accessOK = true;
	try {
		logFile = new File(options.fileString, mode);
		}
	catch(err){
		accessOK = false;
		}
	options.fileString = logFile.fileString;
	if (!accessOK) {
		advise(7, "Unable to access file in required mode");
		chooseFile();
		return;
		}
	options.status = "recording";
	consoleName(scriptName+ "_"  + options.status);
	nmeaBuffer = {};
	OCPNonAllNMEA0183(nmea0183Capture);
	startN2k();
	onAllSeconds(capture, options.interval);
	onCloseButton();
	onCloseButton(inActionDialogue);
	oneTimeAdvice();
	}

function resumeRecording(){
	if (trace) print("resumeRecording - logFile: ", logFile.fileString,
		" position: ", logFile.tell(), "\n");
	options.status = "recording";
	consoleName(scriptName+ "_"  + options.status);
	OCPNonAllNMEA0183(nmea0183Capture);
	startN2k();
	onAllSeconds(capture, options.interval);
	onCloseButton(inActionDialogue);
	}

function stopRecording(){
	onSeconds();	// cancel timers
	OCPNonNMEA0183();
	OCPNonNMEA2000();
	delete logFile;	//closes - does not delete file
	options.status = "stopped"
	consoleName(scriptName + "_" + options.status);
	onCloseButton(mainDialogue);
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
		buffer += sentence + "*" + NMEA0183checksum(sentence) + "\n";
		}
	nmeaStash = {};

	// process the stashed N2k data
	// uncomment next lines two inject simulated data for debugging. Don't forget to disable afterwards
	// n2kStash[128267] = [147,19,255,11,245,1,255,255,155,107,24,19,8,255,90,1,0,0,50,251,255]; // water depth
	// n2kStash[130306] = [147,19,255,2,253,1,255,255,220,107,24,19,6,255,220,5,188,122,251]; // wind

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
	if (buffer.length < 1) return;		// avoid writing of no data
	if (logToDisplay) print(buffer.length, "chars: ", buffer);
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
	ref = obj.reference;
	if (typeof ref == "object") ref = ref.value;	// handle revised NMEA2000
	switch (ref){
		case "Apparent":
		case 2:
			ref = "R"; break;
		case "True (boat referenced)":
		case 3:
			ref = "T"; break;
		default: throw("PGN130306 has unsupported reference " + obj.reference + " please report this");
		}
	sentence = "$" + sender +"MWV," +angle.toFixed(2) + "," + ref + "," + speed.toFixed(2) + ",K,A";
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
			lastPosition: false,		// position at last recordings
			status: "firstTime",
			autoStart: false,
			adviceGiven: false
			}
		if (_remember.hasOwnProperty("versionControl"))	// clear any previous version control
			_remember.versionControl = undefined;
		}
	options = _remember.options;	// for convenience
	}

function addOptions(dialogue){
	intervalIndex = dialogue.length;
	dialogue.push({	type:"field", label:"Recording every", width:50,value:(options.interval), suffix:"seconds"});
		distanceIndex = dialogue.length;
	dialogue.push({	type:"field", label:"Minimum distance", width:60,value:(options.distance), suffix:"nm"})
	dialogue.push({type:"hLine"});
	return dialogue;
	}

function mainDialogue(){
	if (trace) print("In main dialogue\n");
	var dialogue = [{type:"caption", value:scriptName}];
	dialogue = addOptions(dialogue);
	switch (options.status){
		case "stopped":
			dialogue.push({type:"button", label:"Select existing file"});
			if (options.fileString != ""){
				dialogue.push({type:"text", value:"Selected file " + options.fileString});
				dialogue.push({type:"button", label:["Record overwriting", "Record appending"]});
				}
			dialogue.push({type:"hLine"});
			dialogue.push({type:"button", label:"Record to new file"});
			autoIndex = dialogue.length;
			tickText = "Resume recording on restart";
			dialogue.push({type: "tick", value: options.autoStart ? ("*" + tickText):tickText});
			break;
		case "paused":
			dialogue.push({type:"button", label:["Resume", "End"]});
			break;
		}
	dialogue.push({type:"hLine"});
	dialogue.push({type:"button", label:["Stop script", "Dismiss"]});
	onDialogue(mainDialogeResponse, dialogue);
	}

function collectDetails(response){
	if (typeof response[intervalIndex] != "undefined"){
		options.interval = Number(response[intervalIndex].value);	// pick up interval
		if (options.interval < 1) options.interval = 1;	// minimum recording interval
		}
	if (typeof response[distanceIndex] != "undefined"){
		options.distance = Number(response[distanceIndex].value);	// pick up minimum distance
		if (options.distance < 0) options.distance = 0;
		}
	if (typeof  response[autoIndex] != "undefined")
		options.autoStart = response[autoIndex].value;
	}

function mainDialogeResponse(response){
	button = response[response.length-1].label;
	collectDetails(response);
	switch (button){
		case "Select existing file":
			options.fileString = getFileString("??", WRITE);
			mainDialogue();
			return;
		case "Record to new file":
//			collectDetails(response);
			startRecording("??", WRITE_EXCL);
			return;
		case "Record overwriting":
//			collectDetails(response);
			startRecording(options.fileString, WRITE);
			return;
		case "Record appending":
//			collectDetails(response);
			startRecording(options.fileString, APPEND);
			return;
		case "Resume":
			resumeRecording();
			return;
		case "End":
			stopRecording();
			return;
		case "Stop script":
			stopScript("Script stopped");
			return;
		case "Dismiss":
//			options.autoStart = response[autoIndex].value;
			onCloseButton();
			onCloseButton((options.status == "recording")?inActionDialogue:mainDialogue);
			oneTimeAdvice();
			return;
		}	
	}

function inActionDialogue(){
	if (trace) print("inActionDialogue\n", JSON.stringify(options, null, "\t"), "\n");
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
			if (options.mode == WRITE_EXCL) buttons = ["Stop script", "Dismiss", "Record"];
			else buttons = ["Stop script", "Dismiss", "Record overwriting", "Record appending"];
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
		autoIndex = dialogue.length;
		dialogue.push({type: "tick", value: "Resume recording on restart"});
		}
	dialogue.push({type: "button", label:buttons});
	onDialogue(inActionResponse, dialogue);
	}

function inActionResponse(response){
	if (trace) print("inActionResponse\n");
	button = response[response.length-1].label;
	switch (button){
		case "Stop script": stopScript("Script stopped");
		case "Dismiss":
			break;
		case "End":
			stopRecording();
			break;
		case "Pause":
			onSeconds();	// cancel timers
			OCPNonNMEA0183();	// and inputs
			OCPNonNMEA2000();
			options.status = "paused";
			consoleName(scriptName + "_" + options.status);
			break; 
		}
	onCloseButton();
	onCloseButton((options.status == "recording")?inActionDialogue:mainDialogue);
	oneTimeAdvice();
	}


function advise(time, message){	// timed alert
	alert(message);
	onSeconds(cancelAlert, time);
	}

function cancelAlert(){
	alert(false);
	}

function oneTimeAdvice(){
	if (options.adviceGiven) return;
	advice = "To bring up the script controls again\nhold down Command key (Windows Ctrl)\nand click on the console's Close button";
	advise(20, advice);
	options.adviceGiven = true;
	}

function tidyUp(){
	consoleName(scriptName);
	}
