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
            final_answer = ds.run_gaia_task_from_library(entry, entry_command)
            if final_answer is None:
                return jsonify({ "status": "error" })
            else:
                expected = entry["Final answer"].lower()
                if expected == final_answer:
                    return jsonify({ "status": "correct", "actual": final_answer })
                else:
                    return jsonify({ "status": "incorrect", "expected": expected, "actual": final_answer })
    return jsonify({ "status": "error" })
