from flask import Flask, jsonify, request
from flask_cors import cross_origin

import ds


app = Flask(__name__)
validation = ds.all_of_the_validation_tests()

@app.get("/gaia")
@cross_origin()
def fetch_all():
    data = ds.pull_out(validation, ["task_id", "Level", "Question"])
    return jsonify(data)


@app.get("/gaia/<string:task_id>")
@cross_origin()
def fetch_single(task_id):
    for entry in validation:
        if entry["task_id"] == task_id:
            return jsonify(entry)
    return jsonify(None)


@app.post("/gaia/run")
@cross_origin()
def run_single():
    task_id = request.json["task_id"]
    entry_command = request.json["command"]
    for entry in validation:
        if entry["task_id"] == task_id:
            correct = ds.run_gaia_task(entry, entry_command)
            if correct:
                return "correct"
            else:
                return "incorrect"
    return "error"
