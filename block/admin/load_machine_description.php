<?php
/*
 * Copyright (c) 2015, Josef Kufner  <josef@kufner.cz>
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 * 
 *     http://www.apache.org/licenses/LICENSE-2.0
 * 
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 */


/**
 * Retrieve block description
 *
 * This block is meant only for development.
 *
 * TODO: Throw this block away.
 */
class B_smalldb_editor__admin__load_machine_description extends \Cascade\Core\Block {

	protected $inputs = array(
		'machine_type' => null,
	);

	protected $outputs = array(
		'machine_description' => true,
		'done' => true,
	);


	public function main()
	{
		$desc = $this->context->smalldb->describeType($this->in('machine_type'));
		$this->out('machine_description', $desc);
		$this->out('done', !empty($desc));
	}

}

