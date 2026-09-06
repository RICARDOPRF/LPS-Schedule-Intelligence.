package com.leanperformancesolutions.schedule;

import org.mpxj.ProjectFile;
import org.mpxj.mpp.MPPReader;
import org.mpxj.mspdi.MSPDIWriter;

public final class MppToXml {
    private MppToXml() {}

    public static void main(String[] args) throws Exception {
        if (args.length != 2) {
            System.err.println("Usage: MppToXml <input.mpp> <output.xml>");
            System.exit(2);
        }

        MPPReader reader = new MPPReader();
        // Schedule Intelligence needs schedule data, not saved UI/Gantt formatting.
        // Skipping presentation data avoids graphics/AWT dependencies on headless servers.
        reader.setReadPresentationData(false);
        ProjectFile project = reader.read(args[0]);

        MSPDIWriter writer = new MSPDIWriter();
        // MPXJ deliberately disables timephased MSPDI output by default.
        // The LPS engine needs this data to reproduce Task Usage / Resource Usage
        // distributions for HH and to use work as an explicit physical-distribution proxy.
        writer.setWriteTimephasedData(true);
        writer.write(project, args[1]);
    }
}
