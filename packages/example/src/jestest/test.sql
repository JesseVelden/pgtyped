/*
  @name insertTimes
  @param time -> (period)
*/
INSERT INTO times (period) VALUES :time RETURNING id, period, created_at;
