// 定义要轮询的实体列表
const entities = [
    "sensor.0x158d00044fdb62_temperature",   // 实体时长不更新，且实体状态unavailable
    "sensor.tasmota_ds18b20_2_temperature",  // 正常实体
    "sensor.zywdongpdx_temperature",   // 正常实体
    "sensor.0x158d00044fdb62_te" // 不存在的实体
];

// 获取当前时间
var newtime = flow.get("newtime");
if (!newtime) {
    node.error("当前时间未设置");
    return null; // 返回null以中断流程
}

// 轮询每个实体
for (const entity_id of entities) {
    var sensorState = global.get('homeassistant').ha.states[entity_id];
    var currentTime = new Date(newtime).getTime(); // 获取当前时间的时间戳
    var lastNotifyTime = flow.get(entity_id); // 获取上次通知时间
    lastNotifyTime = lastNotifyTime ? new Date(lastNotifyTime).getTime() : 0; // 转换为时间戳

    // 检查实体状态是否存在
    if (!sensorState) {
        if (currentTime - lastNotifyTime >= (12 * 60 * 60 * 1000)) { // 12小时
            notifyEntityNotFound(entity_id);
            node.warn("实体ID: " + entity_id + " 未找到。");
            flow.set(entity_id, newtime); // 记录通知时间
        }
        continue; // 继续下一个实体
    }

    // 获取实体的状态和更新时间
    var state = sensorState.state;
    var oldtime = sensorState.last_updated; // 使用last_updated
    var friendly_name = sensorState.attributes.friendly_name;

    if (!oldtime || !state || !friendly_name) {
        node.error("缺少必要的数据字段: " + JSON.stringify(sensorState));
        continue; // 继续下一个实体
    }

    // 将last_updated转换为本地时间
    var oldtimeLocal = new Date(oldtime).getTime() + (8 * 60 * 60 * 1000); // 转换为UTC+8时间

    var timeDiffInSeconds = calculateTimeDifference(new Date(newtime), new Date(oldtimeLocal));
    var { minutesDiff, hoursDiff, daysDiff, yearsDiff } = calculateTimeUnits(timeDiffInSeconds);

    // 调试输出，查看状态和更新时间
    node.warn(`实体ID: ${entity_id}, 状态: ${state}, 最后更新时间: ${oldtime}, 当前时间: ${newtime}, 时间差: ${yearsDiff}年 ${daysDiff}天 ${hoursDiff}小时 ${minutesDiff}分钟`);

    // 如果状态为 unavailable 或 unknown，或者时间差大于 30 分钟，进行通知
    if ((state === "unavailable" || state === "unknown" || minutesDiff > 30) && 
        (currentTime - lastNotifyTime >= (12 * 60 * 60 * 1000))) { // 12小时
        notifySensorIssue(entity_id, friendly_name, oldtime, state, yearsDiff, daysDiff, hoursDiff, minutesDiff);
        flow.set(entity_id, newtime); // 更新通知时间
    }
}

// 通知实体未找到
function notifyEntityNotFound(entity_id) {
    node.warn("通知未找到实体: " + entity_id);

    var msg = {}; // 创建新消息对象
    msg.payload = {
        "touser": "jjcsjjtz",
        "msgtype": "news",
        "agentid": "1000002",
        "news": {
            "articles": [
                {
                    "title": "系统警告：未找到实体",
                    "description": "未能找到实体ID: " + entity_id + "，请检查配置。",
                }
            ]
        }
    };
    node.send(msg); // 发送消息
}

// 通知传感器问题
function notifySensorIssue(entity_id, friendly_name, oldtime, state, yearsDiff, daysDiff, hoursDiff, minutesDiff) {
    var msg = {}; // 创建新消息对象
    msg.payload = {
        "touser": "jjcsjjtz",
        "msgtype": "news",
        "agentid": "1000002",
        "news": {
            "articles": [
                {
                    "title": "系统工单：当前传感器存在长时间未更新情况，请及时处理",
                    "description": "离线传感器ID:" + entity_id + "\n" +
                                   "离线传感器名称：" + friendly_name + "\n" +
                                   "离线时长：" + yearsDiff + "年 " + daysDiff + "天 " + hoursDiff + "小时 " + minutesDiff + "分钟\n" +
                                   "\n" + "最后更新时间：" + oldtime + "\n" +
                                   "传感器最后更新值：" + state + "\n" +
                                   "当前系统时间：" + newtime,
                }
            ]
        }
    };
    node.send(msg); // 发送消息
}

// 计算时间差
function calculateTimeDifference(startTime, endTime) {
    return Math.abs((endTime - startTime) / 1000); // 返回秒
}

// 计算时间单位
function calculateTimeUnits(timeInSeconds) {
    var secondsDiff = Math.floor(timeInSeconds);
    var minutesDiff = Math.floor(secondsDiff / 60);
    var hoursDiff = Math.floor(minutesDiff / 60);
    var daysDiff = Math.floor(hoursDiff / 24);
    var yearsDiff = Math.floor(daysDiff / 365);
    return { minutesDiff, hoursDiff, daysDiff, yearsDiff }; // 返回所有时间单位
}
