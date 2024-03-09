# VDR2
 
This JavaScript provides a Voyage Data Recorder for OpenCPN.  It is inspired by the VDR plugin but enhances functionality in various ways.

## Recording frequency

You set a recording interval in the options.  The plugin acumulates data for that period, keeping just the latest.  When the interval is up, it writes the data to file as NMEA0183 records.  The sie of the log file is greatly reduced by onlyrecording data every few seconds.

## Source of navigation data

Rather than logging the basic navigation data (position, CMG, SMG) directly from the received NMEA data, VDR2 generates the NMEA0183 records from OpenCPN navigation data.  Thus it uses whatever navigation OpenCPN is using, whether it be NMEA0183, NMEA2000 or SignalK.

## NMEA2000 data

If you have an NMEA2000 input, VDR2 can log that data by converting it to NMEA0183 sentences.  It does not rely on OpenCPN to performthe decoding but can handle any PGN for which there is a descriptor in the Canboat library.  The script has a table of PGNs to be listened for and the converter function which generates the NMEA0183 sentence.  These converter functions are quite simple - perhaps 6-7 lines of code.

At present, there are converters for PGN 128267 (depth) and PGN 30306 (wind).  Morecan be added as required.
