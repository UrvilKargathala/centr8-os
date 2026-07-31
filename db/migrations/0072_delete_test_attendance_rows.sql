-- Attendance Batch 2 — deleting the only 2 rows that exist in
-- attendance_records: both for the same employee (Milind Bhalala), both
-- never checked out, status never differentiated from the default. Smoke-
-- test data from Prompt 5.2's build, not real usage (confirmed with Urvil
-- before this batch). Deleted before the column restructure below so the
-- rename/retype migrations don't need to carry any data forward.
delete from attendance_records;
