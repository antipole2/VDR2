# Adding additional NMEA2000 converters

This is not difficult.  All the hard work decoding the binary data is done by the plugin.
It can handle any PGN for which there is a PGN descriptor in the Canboat project library.

Start by noting how it is done for _PGN 130306 - wind_.

In the `n2kConverters` table is an entry declaring the PGN and the name of its conversion function, thus:

`130306: convert128267,	// wind`

The converter function is:

````
function convert130306(obj){	// wind
	var sentence;
	if (trace2k) print(JSON.stringify(obj, null, "\t"), "\n");
	angle = obj.windAngle * 57.29578;	// angle from radians to degrees
	speed = obj.windSpeed * 1.943844;	// speed from m/s to knots
	switch (obj.reference){
		case "Apparent":
			ref = "R"; break;
		case "True (boat referenced)":
			ref = "T"; break;
		default: throw("PGN130306 has unsupported reference " + obj.reference + " please report this");
		}
	sentence = "$" + sender +"MWV," +angle.toFixed(2) + "," + ref + "," + speed.toFixed(2) + ",K,A";
	buffer += sentence + "*" + NMEA0183checksum(sentence) + "\n";
	}
````

The function is passed the JavaScript object containing the decoded data.

Start by copying this function, uncommenting the print statement and omitting the rest.

Add the appropriate entry to the `n2kConverters` table and test.

The print of the object will show you the attributes of the object.

Following the example above, you can build the NMEA0183 sentence (or sentences) to represent the NME2000 data.
You can print it out with

`print(sentence, "\n");`

When you are satisfied with that, add back the final statement, which adds your sentence and its checksum to the output buffer.
You can then comment out your print statements.

You might like to share your converter in the script discussions.  It could be included in future versions.
