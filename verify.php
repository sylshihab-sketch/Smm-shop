<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: Content-Type");
header("Content-Type: application/json");

$botToken = "8934648475:AAGPf3Bu8PKppn_8RY4gmutvqwm9eyrJy2A";

$data = json_decode(file_get_contents("php://input"), true);
$userId = $data['userId'] ?? '';
$chatId = $data['chatId'] ?? '';

if (!$userId || !$chatId) {
    echo json_encode(["isJoined" => false, "message" => "Invalid parameters"]);
    exit;
}

$url = "https://api.telegram.org/bot{$botToken}/getChatMember?chat_id={$chatId}&user_id={$userId}";

$ch = curl_init();
curl_setopt($ch, CURLOPT_URL, $url);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
$response = curl_exec($ch);
curl_close($ch);

$result = json_decode($response, true);

if (isset($result['ok']) && $result['ok']) {
    $status = $result['result']['status'];
    if (in_array($status, ['member', 'administrator', 'creator'])) {
        echo json_encode(["isJoined" => true]);
        exit;
    }
}

echo json_encode(["isJoined" => false]);
?>