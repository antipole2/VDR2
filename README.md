# VDR2
 
This JavaScript provides a Voyage Data Recorder for OpenCPN.  It is inspired by the VDR plugin but enhances functionality in various ways.

## Recording frequency & distance

You set a recording interval in the options.  The plugin accumulates data for that period, keeping just the latest.  When the time interval is up, it writes the data to the file as NMEA0183 records.  The default period is 30s.  The size of the log file is greatly reduced by only recording data at intervals.

You can set a minimum distance before a new set of entries is made.  If the boat has not moved that far from the previous entry, the recording will be skipped.  The default is 0.02nm, which limits recording when becalmed and pauses it completely when at anchor.

## Source of navigation data

Rather than logging the basic navigation data (position, CMG, SMG) directly from the received NMEA0183 data, VDR2 generates these NMEA0183 records from OpenCPN navigational data.  Thus it uses whatever navigation OpenCPN is using, whether it be NMEA0183, NMEA2000 or SignalK.

## Omitting NMEA0183 data

A table `omit` contains NMEA0183 sentence types to be omitted.  Please feel free to add to this as required.

## NMEA2000 data

If you have an NMEA2000 input, VDR2 can log that data by converting it to NMEA0183 sentences.  It does not rely on OpenCPN to perform the decoding but can handle any PGN for which there is a descriptor in the Canboat library.  The script has a table of PGNs to be listened for and a converter function which generates the NMEA0183 sentence.  These converter functions are simple - perhaps 6-7 lines of code.

At present, there are converters for PGN 128267 (depth) and PGN 30306 (wind).

### Omitting or adding NMEA2000 data

The table `n2kConverters` comprises the PGNs to be listened for and their converter functions.

To omit from recording, comment out the relevant table entry.

To add additional NMEA2000 data, you need to provide a converter function.
For instructions on how to do this, [see here](https://github.com/antipole2/VDR2/blob/main/adding_NMEA2000_converters.md).

## Control panel

The script presents a control panel through which you can set

* Recording frequency
* Minimum distance between records

You can create a new file or select an existing one.
If you are recording to an existing file, you can choose to overwrite it or append to existing data.

There is an option to automatically resume recording on script start-up if you were recording when the script stopped.
Combining this with the option to automatically start the script, you could arrange for recording to resume when OpenCPN starts up.

#### Calling up the control panel

When a control panel choice has been made, the panel is no longer displayed. All that is visible is the parked console.  To summon up the control panel - perhaps to start, stop or pause recording, you click on the console's close button.
(This may seem counter-intuitive but that is how it is.)

#### Controlling the recording

While recording is in progress you can summon a panel that allows you to pause or end the recording.

If recording is paused, you have the option to resume recording with the same or a different frequency or minimum distance or to end recording.

All the panels have the option to dismiss them.
This leaves the script running but with no change in the action.
It is a way of clearing the panel out of the way.
You would need to summon the panel back using the Close button.

There is also the option to stop the script.

## Installing the script

You need the JavaScript plugin v3 or later.

1. Copy this URL to your clipboard (copy the link - do not follow it) - `https://raw.githubusercontent.com/antipole2/VDR2/main/vdr2.js`
2. In a JavaScript console choose `Load` and then `URL on clipboard`.  The script should be loaded into the script pane.
3. Choose `Run` to start the script.

NB If you want to run the script when not online, you will need to save it to a local file.

## Updates

This script has automatic checking for updates.

## Discussions

To discuss this script's functionality, use the Discussions tab above.

## Technical notes

1. If you want to see what is being written to the file without having to look inside, change `false` to `true` in the following line  
`logToDisplay = false;	// data will appear in the output pane`  

2. The script options are stored in the console's `_remember` variable.  They thus endure between script runs and across OpenCPN restarts (provided OpenCPN quits gracefully).  The `_remember` variable is unique to the console.  Should you run the script in a different console, it will have fresh option settings.
  
4. There is a [description of how the script works](https://github.com/antipole2/VDR2/blob/main/how_this_scriptworks%20.md), which should help understand it.  It also describes the programming techniques that could be useful elsewhere.
