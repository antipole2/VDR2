# How this script works

Here is a description of how this script works.

This could be useful t anyone wanting to develop it.
It may also be of use to others as it describes a number of techniques that could be useful elsewhere.

## Script preamble

The first part contains declarations used to configure how the script behaves.

`omit` is an array of NMEA0183 sentence types that should not be recorded.

There are boolean values to control whether or not data is written to file and/or printed on teh screen

n2kConverserts is a structure (not an array) linking PGNs to their converter functions.
More about these later.

Next declarations of variables or values that needto endure during the life of the execution.

## Debugging section

Here we n set values that can be used for tracing.
THere are two different trace settings trace for general tracing and trace2k specifically to trace within NMEA2000 processing.

## _remember

This script makes use of the _remember variable introduced in the plugin v3.
This is used to store options or other information that ensures between runs.
See the User Guide for more information.

Here we chack whether options have been saved from a previous script run.
If not they are set to inituil values.
In the debugging section, there is a statement commented out that undefines _remember.
This can be used to force 'first time' behaviour for testing.

## Initial action

Here we examinethe options to decide what has to happen first.

## End of start up

This is the end of the code executed directly.
The rest of the script comprises subroutine functions or those invoked to service to various events.

## The control dialogues

The first four functions manage the dialogues.

There are two dialogues - one for file selection and one for controlling recording.
THey are both created by the onDialogue function, described in the User Guide.

The onDialogue function arguments are the name of the function to be invoked when the user clicks on a button and an array defining the elements of the dialogue to be created.

In this script, we construct the array dynamically becausethe dialogue elments depend on circumstances.
When the result is processed the function is passed a copy of the array with values as set by the user.
We need to know th index of the various elements.
So we construct the array by pushing the elements onto it and noting the various index values for use when processing the array.

## The Console Close button

In order to avoid cluttering screen space, the console parks itself out of the way once it is running.

IT is also possible to hide the consoles completely by toggling the JS icon in the control strip.

The dialogues are also keep out of the way when not needed - such as during recording or when in standby.

The issue then is how to bring up the dialogues when needed.
Quirkely, we use the console Close button as this is the only attribute of a minimised console window that can raise an event on all platforms.
On MacOS, the oarnage button would be a better choice for parking or unparking but it is not supported in wxWidgets as it is not cross-platform.

See OCPNonConsoleClose in the User Guide for more details.

## Recording control

There follow functions to start or resume recording

## Stashing data

When NMEA0183 data is received, it ishandled by `nmea0183Capture`.
After filtering out sentences not to be recodred, it stashes them.

The stash is a structure where the attributes are the NMEA sentencetype.
This has the desired property that when a further sentnce of the same type is received during the recording period,
any earlier data is overwritten.
Thus just the last receivedis written out to file.

## Capture

This function is invoked at the recording interval.

It captutes the OCPN navigation data that will be used to synthesis the basic NMEA0183 sentences that are not being taken from the NMEA0183 input stream.

It checks whether we have moved far enough according to the distanceoption and then processesthe stashesinto NMEA0183 sentences.

## NMEA2000 data processing

The NMEA2000 object constructor constructs objects that can decode specific payloads according to their PGN.
This is not a trivial process as the constructor has to read through all the PGN descriptors to find the right one.
This is, therefore, done once at the start for each PGN rather than each time data is received.

# Function setupN2k

This examines the comms ports to locate any N2K one.
As written, it uses the first one found.

It then constructs anNMEA2000 object for each PGN and stoes it in the n2Kobjects with the PGN as its attribute - thus making access easy.

## Handling NMEA2000 data

All NMEA2000 payloads are handled by the same function n2kCapture, which stashes the playload by PGN.
Subsequent payloads of teh same PGN replace earlier ones.

We have stashed the raw payload to avoid decoding payloads that would be replaced by a later one.

In the capture function, we work through all PGNs for which we have payloads and decode them using the relevant NMEA2000 object and then pass the JavaSCript object to the relevant converter function, which generates th NMEA0183 sentence.

This technique was developed without NMEA2000 input.
There is commented-out code that stashes example payloads for water depth and windfor testing purposes.

## advise and cancelAlert functions

The `advise` is used to display an alert that will self-cancel after an interval if no further alerts jave been raised.

## Version checking

This is an experimental system to prompt users to update the script when a new version becomes available.

It checks whether we are online and if time has elased since the last check, which is stored in _remember.

If a check is due, it reads a version control file `version.JSON`from the repository which contains JSON like this:

````
{"name":"VDR2",
	"version":1.0,
	"date":"6 Apr 2024",
	"new":"Initial release"
}
````
It compares the version number with its own version number and proposes to download the new version.

If the user has modified their copy of the scipt, these chnages would b lost.
So it issues appropriate warnings.

If the go ahead is given, the new version is downloaded into the script pane.
Note that the console is still running the previous version.
All that remains isto stop th script and restart using the new version.



