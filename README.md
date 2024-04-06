# VDR2
 
This JavaScript provides a Voyage Data Recorder for OpenCPN.  It is inspired by the VDR plugin but enhances functionality in various ways.

## Recording frequency & distance

You set a recording interval in the options.  The plugin accumulates data for that period, keeping just the latest.  When the time interval is up, it writes the data to the file as NMEA0183 records.  The size of the log file is greatly reduced by only recording data at intervals.

You can set a minimum distance before a new set of entries is made.  If the boat has not moved that far from the previous entry, the recording will be skipped.  If you, for example, set a minimum distance of 0.01, this would limit recording when becalmed and pause it completely when at anchor.

## Source of navigation data

Rather than logging the basic navigation data (position, CMG, SMG) directly from the received NMEA data, VDR2 generates these NMEA0183 records from OpenCPN navigation data.  Thus it uses whatever navigation OpenCPN is using, whether it be NMEA0183, NMEA2000 or SignalK.

## Omitting NMEA0183 data

There is a table `omit` containing NMEA0183 sentence types to be omitted.  You can add to this as required.

## NMEA2000 data

If you have an NMEA2000 input, VDR2 can log that data by converting it to NMEA0183 sentences.  It does not rely on OpenCPN to perform the decoding but can handle any PGN for which there is a descriptor in the Canboat library.  The script has a table of PGNs to be listened for and the converter function which generates the NMEA0183 sentence.  These converter functions are quite simple - perhaps 6-7 lines of code.

At present, there are converters for PGN 128267 (depth) and PGN 30306 (wind).  More can be added as required.

### Omitting or adding NMEA2000 data

The table `n2kConverters` comprises the PGNs to be listened for and their converter functions.

To omit from recording, comment out the relevant table entry.

To add additional NMEA2000 data, you need to provide a converter function.
For instructions on how to do this, [see here](https://github.com/antipole2/VDR2/blob/main/adding_NMEA2000_converters.md).

## Control panel

The script presents one dialogue to select the log file and another to control recording.

The recording interval can be set and recording started, paused or ended.

The recording mode can be

#### Overwrite

When recording starts, it overwrites the log file.

#### Append

Data is appended to any existing data in the log file

#### Append (auto start)

In this mode, if recording was in progress when the script stopped (or the plugin was disabled) then recording will automatically recommence when the script runs again.  If you combine this with the console _Auto run_ option, recording will automatically recommence when the plugin is loaded.  Thus recording can be auomatically started when OpenCPN is launched.  An alert is displayed for a short while to advise that recording has recommenced.

#### Calling up the control panel

When a control panel choice has been made, the panel is no longer displayed. All that is visible is the parked console.  To summon up the control panel - perhaps to start, stop of paise recording, you ca click on the console's close button.

## Installing the script

1. Copy this URL to your clipboard (copy link - do not follow it) - `https://raw.githubusercontent.com/antipole2/VDR2/main/vdr2.js`
2. In a JavaScript console choose `Load` and then `URL on clipboard`.  The script should be loaded into the script pane.
3. Choose `Run` to start the script.

NB If you want to run the script when not online, you will need to save it to a local file.

## Updates

This script has automatic checking for updates.

## Discussions

To discuss this script's functionality, use the Discussions tab above.

## Technical note

The script options are stored in the console's `_remember` variable.  They thus endure between script runs and across OpenCPN restarts (provided OpenCPN quits gracefully).  The `_remember` variable is unique to the console.  Should you run the script in a different console, it will have fresh option settings.
