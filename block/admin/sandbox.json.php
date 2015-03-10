{
    "_": "<?php printf('_%c%c}%c',34,10,10);__halt_compiler();?>",
    "blocks": {
        "training_dummy": {
            "block": "core/out/output",
            "x": 171,
            "y": 858,
            "in_con": {
                "data": [
                    "describe_machine",
                    "machine_description"
                ],
                "enable": [
                    "describe_machine",
                    "done"
                ]
            },
            "in_val": {
                "template": "smalldb_editor/training_dummy"
            }
        },
        "describe_machine": {
            "block": "smalldb_editor/admin/load_machine_description",
            "x": -175,
            "y": 887,
            "in_val": {
                "machine_type": "article"
            }
        }
    }
}