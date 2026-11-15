const db = require('../db');
function logActivity(circleId, actor, action, detail = '') {
  db.prepare('INSERT INTO activity_log(circle_id, actor, action, detail) VALUES(?,?,?,?)').run(circleId, actor, action, detail);
}
module.exports = { logActivity };