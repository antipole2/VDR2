# How this script works

Here is a description of how this script works.

This could be useful to anyone wanting to develop it.
It may also be of help to others as it describes many techniques that could be useful elsewhere.

## Script preamble

The first part contains declarations used to configure how the script behaves.

`omit` is an array of NMEA0183 sentence types that should not be recorded.

There are boolean values to control whether or not data is written to file and/or printed on the screen

n2kConverters is a structure (not an array) linking PGNs to their converter functions.
More about these later.

Next are declarations of variables or values that need to endure during the life of the execution.

## Debugging section

Here we set values that can be used for tracing.
There are two different trace settings `trace` for general tracing and `trace2k` specifically to trace within NMEA2000 processing.

## _remember

This script makes use of the `_remember` variable introduced in the plugin v3.
This is used to store options or other information that endures between runs.
See the User Guide for more information.

Here we check whether options have been saved from a previous script run.
If not they are set to initial values.
In the debugging section, there is a statement commented out that undefines `_remember`.
This can be used to force 'first-time' behaviour for testing.

## Initial action

Here we examine the options to decide what has to happen first.

## End of start-up

This is the end of the code executed directly.
The rest of the script comprises subroutine functions or those invoked to service to various events.

## The control dialogues

There are two dialogues.
The main one is used to start recording.
There is a secondary one used to pause or end recording.
They are both created by the `onDialogue` function, described in the User Guide.

The `onDialogue` function arguments are the name of the function to be invoked when the user clicks on a button and an array defining the elements of the dialogue to be created.

In this script, we construct the array dynamically because the dialogue elements depend on circumstances.
When the result is processed the function is passed a copy of the array with values as set by the user.
We need to know the index of the various elements.
So we construct the array by pushing the elements onto it and noting the various index values for use when processing the array.

## The Console Close button

To avoid cluttering screen space, the console parks itself out of the way once it is running.

It is also possible to hide the consoles completely by toggling the JS icon in the control strip.

The dialogues are also kept out of the way when not needed - such as during recording or when on standby.

The issue then is how to bring up the dialogues when needed.
Quirkely, we use the console Close button as this is the only attribute of a minimised console window that can raise an event on all platforms.
On MacOS, the orange button would be a better choice for parking or unparking but it is not supported in wxWidgets as it is not cross-platform.

See OCPNonConsoleClose in the User Guide for more details.

## Recording control

There follow functions to start or resume recording

## Stashing data

When NMEA0183 data is received, it is handled by `nmea0183Capture`.
After filtering out sentences not to be recodred, it stashes them.

The stash is a structure where the attributes are the NMEA sentence type.
This has the desired property that when a further sentence of the same type is received during the recording period,
any earlier data is overwritten.
Thus just the last received is written out to file.

## Capture

This function is invoked at the recording interval.

It captutes the OCPN navigation data that will be used to synthesis the basic NMEA0183 sentences that are not being taken from the NMEA0183 input stream.

It checks whether we have moved far enough according to the distance option and then processes the stashes into NMEA0183 sentences.

## NMEA2000 data processing

The NMEA2000 object constructor constructs objects that can decode specific payloads according to their PGN.
This is not a trivial process as the constructor has to read through all the PGN descriptors to find the right one.
This is, therefore, done once at the start for each PGN rather than each time data is received.

## Function setupN2k

This examines the comms ports to locate any N2K one.
As written, it uses the first one found.

It then constructs an NMEA2000 object for each PGN and stoes it in `n2Kobjects` with the PGN as its attribute - thus making access easy.

## Handling NMEA2000 data

All NMEA2000 payloads are handled by the same function `n2kCapture`, which stashes the payload by PGN.
Subsequent payloads of the same PGN replace earlier ones.

We have stashed the raw payload to avoid decoding payloads that would be replaced by a later one.

In the capture function, we work through all PGNs for which we have payloads and decode them using the relevant NMEA2000 object and then pass the JavaScript object to the relevant converter function, which generates the NMEA0183 sentence.

This technique was developed without NMEA2000 input.
There is commented-out code that stashes example payloads for water depth and wind for testing purposes.

## advise and cancelAlert functions

The `advise` function is used to display an alert that will self-cancel after an interval if no further alerts have been raised.

## Version checking

The script checks for new versions using the mechanism built into the JavaScript plugin v2.1.
All that remains is to stop th script and restart using the new version.
