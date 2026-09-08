package com.leanperformancesolutions.schedule;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.mpxj.Duration;
import org.mpxj.LocalDateTimeRange;
import org.mpxj.ProjectFile;
import org.mpxj.ResourceAssignment;
import org.mpxj.TimeUnit;
import org.mpxj.TimescaleUnits;
import org.mpxj.common.TimescaleHelper;
import org.mpxj.mpp.MPPReader;
import org.mpxj.mspdi.MSPDIWriter;

import java.io.File;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

public final class MppToXml {
    private MppToXml() {}

    public static void main(String[] args) throws Exception {
        if (args.length < 2 || args.length > 3) {
            System.err.println("Usage: MppToXml <input.mpp> <output.xml> [daily-timephased.json]");
            System.exit(2);
        }

        MPPReader reader = new MPPReader();
        reader.setReadPresentationData(false);
        ProjectFile project = reader.read(args[0]);

        MSPDIWriter writer = new MSPDIWriter();
        writer.setWriteTimephasedData(true);
        writer.write(project, args[1]);

        if (args.length == 3) {
            writeDailyTimephased(project, args[2]);
        }
    }

    private static void writeDailyTimephased(ProjectFile project, String outputFile) throws Exception {
        List<Map<String, Object>> assignments = new ArrayList<>();
        TimescaleHelper helper = new TimescaleHelper();

        for (ResourceAssignment assignment : project.getResourceAssignments()) {
            LocalDateTime start = assignment.getStart();
            LocalDateTime finish = assignment.getFinish();
            if (start == null && assignment.getTask() != null) start = assignment.getTask().getStart();
            if (finish == null && assignment.getTask() != null) finish = assignment.getTask().getFinish();
            if (start == null || finish == null || finish.isBefore(start)) continue;

            LocalDateTime dayStart = start.toLocalDate().atStartOfDay();
            LocalDateTime dayEnd = finish.toLocalDate().plusDays(1).atStartOfDay();
            List<LocalDateTimeRange> ranges;
            try {
                ranges = helper.createTimescale(dayStart, dayEnd, TimescaleUnits.DAYS);
            } catch (Exception ex) {
                continue;
            }
            if (ranges.isEmpty()) continue;

            List<Duration> total = safeSeries(() -> assignment.getTimephasedWork(ranges, TimeUnit.HOURS), ranges.size());
            List<Duration> actual = safeSeries(() -> assignment.getTimephasedActualWork(ranges, TimeUnit.HOURS), ranges.size());
            List<Duration> remaining = safeSeries(() -> assignment.getTimephasedRemainingWork(ranges, TimeUnit.HOURS), ranges.size());
            List<Duration> planned = safeSeries(() -> assignment.getTimephasedPlannedWork(ranges, TimeUnit.HOURS), ranges.size());

            Map<Integer, List<Duration>> baselines = new LinkedHashMap<>();
            for (int baselineIndex = 0; baselineIndex <= 10; baselineIndex++) {
                Duration baselineTotal;
                try {
                    baselineTotal = assignment.getBaselineWork(baselineIndex);
                } catch (Exception ex) {
                    continue;
                }
                if (hours(baselineTotal) <= 0.0000001) continue;
                final int idx = baselineIndex;
                List<Duration> series = safeSeries(() -> assignment.getTimephasedBaselineWork(idx, ranges, TimeUnit.HOURS), ranges.size());
                if (hasNonZero(series)) baselines.put(idx, series);
            }

            List<Map<String, Object>> days = new ArrayList<>();
            for (int i = 0; i < ranges.size(); i++) {
                double totalHours = hours(at(total, i));
                double actualHours = hours(at(actual, i));
                double remainingHours = hours(at(remaining, i));
                double plannedHours = hours(at(planned, i));

                Map<String, Double> baselineDay = new LinkedHashMap<>();
                for (Map.Entry<Integer, List<Duration>> entry : baselines.entrySet()) {
                    double value = hours(at(entry.getValue(), i));
                    if (Math.abs(value) > 0.0000001) baselineDay.put(String.valueOf(entry.getKey()), round(value));
                }

                if (Math.abs(totalHours) <= 0.0000001 && Math.abs(actualHours) <= 0.0000001 &&
                    Math.abs(remainingHours) <= 0.0000001 && Math.abs(plannedHours) <= 0.0000001 && baselineDay.isEmpty()) {
                    continue;
                }

                Map<String, Object> day = new LinkedHashMap<>();
                day.put("date", ranges.get(i).getStart().toLocalDate().toString());
                if (Math.abs(totalHours) > 0.0000001) day.put("work", round(totalHours));
                if (Math.abs(actualHours) > 0.0000001) day.put("actual", round(actualHours));
                if (Math.abs(remainingHours) > 0.0000001) day.put("remaining", round(remainingHours));
                if (Math.abs(plannedHours) > 0.0000001) day.put("planned", round(plannedHours));
                if (!baselineDay.isEmpty()) day.put("baseline", baselineDay);
                days.add(day);
            }

            if (days.isEmpty()) continue;
            Map<String, Object> out = new LinkedHashMap<>();
            out.put("uid", String.valueOf(assignment.getUniqueID()));
            out.put("taskUid", String.valueOf(assignment.getTaskUniqueID()));
            out.put("resourceUid", String.valueOf(assignment.getResourceUniqueID()));
            out.put("days", days);
            assignments.add(out);
        }

        Map<String, Object> root = new LinkedHashMap<>();
        root.put("version", 1);
        root.put("granularity", "day");
        root.put("assignments", assignments);
        new ObjectMapper().writeValue(new File(outputFile), root);
    }

    @FunctionalInterface
    private interface SeriesSupplier {
        List<Duration> get() throws Exception;
    }

    private static List<Duration> safeSeries(SeriesSupplier supplier, int expectedSize) {
        try {
            List<Duration> result = supplier.get();
            return result == null ? emptySeries(expectedSize) : result;
        } catch (Exception ex) {
            return emptySeries(expectedSize);
        }
    }

    private static List<Duration> emptySeries(int size) {
        List<Duration> result = new ArrayList<>(size);
        for (int i = 0; i < size; i++) result.add(null);
        return result;
    }

    private static Duration at(List<Duration> values, int index) {
        return values != null && index >= 0 && index < values.size() ? values.get(index) : null;
    }

    private static double hours(Duration value) {
        if (value == null) return 0.0;
        double result = value.getDuration();
        return Double.isFinite(result) ? result : 0.0;
    }

    private static boolean hasNonZero(List<Duration> values) {
        if (values == null) return false;
        for (Duration value : values) if (Math.abs(hours(value)) > 0.0000001) return true;
        return false;
    }

    private static double round(double value) {
        return Math.round(value * 1000000.0) / 1000000.0;
    }
}
